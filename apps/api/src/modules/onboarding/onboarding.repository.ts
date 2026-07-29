import {
  Prisma,
  type OnboardingSession,
  type Partner,
  type PrismaClient,
} from "@prisma/client";

export type SessionWithPartner = OnboardingSession & {
  partner: Partner | null;
};

type ValidationUpdate = {
  status:
    | "READY_TO_VALIDATE"
    | "INTEGRATION_INVALID"
    | "INTEGRATION_UNAVAILABLE"
    | "READY_TO_GO_LIVE";
  validationStatus:
    | "valid"
    | "partial"
    | "invalid"
    | "unavailable";
  providerItems: Prisma.InputJsonValue;
  validationWarnings: Prisma.InputJsonValue;
  validationReason: string | null;
};

export type GoLiveResult =
  | { kind: "not_found" }
  | { kind: "invalid_transition"; message: string }
  | { kind: "success"; session: SessionWithPartner; partner: Partner };

export class OnboardingRepository {
  constructor(private readonly client: PrismaClient) {}

  create(): Promise<SessionWithPartner> {
    return this.client.onboardingSession.create({
      data: {},
      include: { partner: true },
    });
  }

  findById(id: string): Promise<SessionWithPartner | null> {
    return this.client.onboardingSession.findUnique({
      where: { id },
      include: { partner: true },
    });
  }

  async updateDetails(input: {
    id: string;
    companyName: string;
    providerAccountId: string;
    providerApiKey: string;
    credentialsChanged: boolean;
  }): Promise<SessionWithPartner | null> {
    const result = await this.client.onboardingSession.updateMany({
      where: {
        id: input.id,
        status: { not: "COMPLETED" },
      },
      data: input.credentialsChanged
        ? {
            companyName: input.companyName,
            providerAccountId: input.providerAccountId,
            providerApiKey: input.providerApiKey,
            credentialsVersion: { increment: 1 },
            status: "READY_TO_VALIDATE",
            validationStatus: "not_started",
            validationCredentialsVersion: null,
            validationReason: null,
            validationWarnings: [],
            partialAcceptedAt: null,
            providerItems: [],
            updatedAt: new Date(),
          }
        : {
            companyName: input.companyName,
            providerAccountId: input.providerAccountId,
            providerApiKey: input.providerApiKey,
            updatedAt: new Date(),
          },
    });

    return result.count === 0 ? null : this.findById(input.id);
  }

  async startValidation(id: string): Promise<SessionWithPartner | null> {
    const result = await this.client.onboardingSession.updateMany({
      where: {
        id,
        status: { not: "COMPLETED" },
        companyName: { not: null },
        providerAccountId: { not: null },
        providerApiKey: { not: null },
      },
      data: {
        status: "READY_TO_VALIDATE",
        validationStatus: "pending",
        validationAttempt: { increment: 1 },
        validationCredentialsVersion: null,
        validationReason: null,
        validationWarnings: [],
        partialAcceptedAt: null,
        providerItems: [],
        updatedAt: new Date(),
      },
    });

    return result.count === 0 ? null : this.findById(id);
  }

  async applyValidation(input: {
    id: string;
    credentialsVersion: number;
    validationAttempt: number;
    result: ValidationUpdate;
  }): Promise<SessionWithPartner | null> {
    const update = await this.client.onboardingSession.updateMany({
      where: {
        id: input.id,
        status: { not: "COMPLETED" },
        credentialsVersion: input.credentialsVersion,
        validationAttempt: input.validationAttempt,
        validationStatus: "pending",
      },
      data: {
        status: input.result.status,
        validationStatus: input.result.validationStatus,
        validationCredentialsVersion: input.credentialsVersion,
        validationReason: input.result.validationReason,
        validationWarnings: input.result.validationWarnings,
        partialAcceptedAt: null,
        providerItems: input.result.providerItems,
        updatedAt: new Date(),
      },
    });

    return update.count === 0 ? null : this.findById(input.id);
  }

  async acceptPartial(id: string): Promise<SessionWithPartner | null> {
    const session = await this.findById(id);
    if (!session) {
      return null;
    }

    if (
      session.status === "READY_TO_GO_LIVE" &&
      session.validationStatus === "partial" &&
      session.partialAcceptedAt
    ) {
      return session;
    }

    const update = await this.client.onboardingSession.updateMany({
      where: {
        id,
        status: "READY_TO_VALIDATE",
        validationStatus: "partial",
        validationCredentialsVersion: session.credentialsVersion,
        partialAcceptedAt: null,
      },
      data: {
        status: "READY_TO_GO_LIVE",
        partialAcceptedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return update.count === 0 ? null : this.findById(id);
  }

  goLive(id: string): Promise<GoLiveResult> {
    return this.client.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM onboarding_sessions
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;

      const session = await transaction.onboardingSession.findUnique({
        where: { id },
        include: { partner: true },
      });

      if (!session) {
        return { kind: "not_found" };
      }

      if (session.status === "COMPLETED") {
        return session.partner
          ? { kind: "success", session, partner: session.partner }
          : {
              kind: "invalid_transition",
              message: "Completed session has no partner account",
            };
      }

      const resultMatchesCredentials =
        session.validationCredentialsVersion === session.credentialsVersion;
      const validResult = session.validationStatus === "valid";
      const acceptedPartial =
        session.validationStatus === "partial" &&
        session.partialAcceptedAt !== null;

      if (
        session.status !== "READY_TO_GO_LIVE" ||
        !resultMatchesCredentials ||
        (!validResult && !acceptedPartial) ||
        !session.companyName
      ) {
        return {
          kind: "invalid_transition",
          message: "Session is not ready to go live",
        };
      }

      const partner = await transaction.partner.upsert({
        where: { onboardingSessionId: session.id },
        update: {},
        create: {
          companyName: session.companyName,
          onboardingSessionId: session.id,
          status: "LIVE",
        },
      });

      const completed = await transaction.onboardingSession.update({
        where: { id: session.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          updatedAt: new Date(),
        },
        include: { partner: true },
      });

      return {
        kind: "success",
        session: completed,
        partner,
      };
    });
  }
}
