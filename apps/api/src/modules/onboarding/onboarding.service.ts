import type {
  GoLiveResponse,
  OnboardingSession,
  SaveDetailsRequest,
} from "@partner-onboarding/contracts";
import type { Prisma } from "@prisma/client";

import type {
  ProviderClient,
  ProviderClientResult,
} from "../../integrations/provider/provider.client.js";
import { AppError } from "../../plugins/app-error.js";
import { toSessionResponse } from "./onboarding.mapper.js";
import { OnboardingRepository } from "./onboarding.repository.js";

export class OnboardingService {
  constructor(
    private readonly repository: OnboardingRepository,
    private readonly providerClient: ProviderClient,
    private readonly trustedPartnerKey: string,
  ) {}

  async createSession(): Promise<OnboardingSession> {
    return toSessionResponse(
      await this.repository.createOrResume(this.trustedPartnerKey),
    );
  }

  async getSession(id: string): Promise<OnboardingSession> {
    const session = await this.repository.findById(id);
    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    return toSessionResponse(session);
  }

  async saveDetails(
    id: string,
    input: SaveDetailsRequest,
  ): Promise<OnboardingSession> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    this.ensureMutable(current.status);

    const apiKey = input.providerApiKey ?? current.providerApiKey;
    if (!apiKey) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Provider API key is required",
        { providerApiKey: ["Provider API key is required"] },
      );
    }

    const credentialsChanged =
      input.providerAccountId !== current.providerAccountId ||
      (input.providerApiKey !== undefined &&
        input.providerApiKey !== current.providerApiKey);

    const updated = await this.repository.updateDetails({
      id,
      companyName: input.companyName,
      providerAccountId: input.providerAccountId,
      providerApiKey: apiKey,
      credentialsChanged,
    });

    if (!updated) {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        "Completed sessions cannot be changed",
      );
    }

    return toSessionResponse(updated);
  }

  async validateIntegration(id: string): Promise<OnboardingSession> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    this.ensureMutable(current.status);
    if (
      !current.companyName ||
      !current.providerAccountId ||
      !current.providerApiKey
    ) {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        "Complete details before validating the integration",
      );
    }

    const pending = await this.repository.startValidation(id);
    if (
      !pending ||
      !pending.providerAccountId ||
      !pending.providerApiKey
    ) {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        "Session cannot start validation",
      );
    }

    const result = await this.providerClient.validateCredentials({
      accountId: pending.providerAccountId,
      apiKey: pending.providerApiKey,
    });

    const updated = await this.repository.applyValidation({
      id,
      credentialsVersion: pending.credentialsVersion,
      validationAttempt: pending.validationAttempt,
      result: this.toValidationUpdate(result),
    });

    if (!updated) {
      throw new AppError(
        409,
        "STALE_VALIDATION_RESULT",
        "A newer validation or credential update replaced this result",
      );
    }

    return toSessionResponse(updated);
  }

  async acceptPartial(id: string): Promise<OnboardingSession> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    this.ensureMutable(current.status);
    const updated = await this.repository.acceptPartial(id);
    if (!updated) {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        "Only a current partial result can be accepted",
      );
    }

    return toSessionResponse(updated);
  }

  async resetSession(id: string): Promise<OnboardingSession> {
    const reset = await this.repository.reset(id, this.trustedPartnerKey);
    if (!reset) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    return toSessionResponse(reset);
  }

  async goLive(id: string): Promise<GoLiveResponse> {
    const result = await this.repository.goLive(id);

    if (result.kind === "not_found") {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    if (result.kind === "invalid_transition") {
      throw new AppError(409, "INVALID_TRANSITION", result.message);
    }

    return {
      session: toSessionResponse(result.session),
      partner: {
        id: result.partner.id,
        companyName: result.partner.companyName,
        status: "LIVE",
        onboardingSessionId: result.partner.onboardingSessionId,
        createdAt: result.partner.createdAt.toISOString(),
      },
    };
  }

  private ensureMutable(status: string): void {
    if (status === "COMPLETED") {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        "Completed sessions cannot be changed",
      );
    }
  }

  private toValidationUpdate(
    result: ProviderClientResult,
  ): {
    status:
      | "READY_TO_VALIDATE"
      | "INTEGRATION_INVALID"
      | "INTEGRATION_UNAVAILABLE"
      | "READY_TO_GO_LIVE";
    validationStatus: "valid" | "partial" | "invalid" | "unavailable";
    providerItems: Prisma.InputJsonValue;
    validationWarnings: Prisma.InputJsonValue;
    validationReason: string | null;
  } {
    switch (result.status) {
      case "valid":
        return {
          status: "READY_TO_GO_LIVE",
          validationStatus: "valid",
          providerItems: result.items,
          validationWarnings: [],
          validationReason: null,
        };
      case "partial":
        return {
          status: "READY_TO_VALIDATE",
          validationStatus: "partial",
          providerItems: result.items,
          validationWarnings: result.warnings,
          validationReason: null,
        };
      case "invalid":
        return {
          status: "INTEGRATION_INVALID",
          validationStatus: "invalid",
          providerItems: [],
          validationWarnings: [],
          validationReason: result.reason,
        };
      case "unavailable":
        return {
          status: "INTEGRATION_UNAVAILABLE",
          validationStatus: "unavailable",
          providerItems: [],
          validationWarnings: [],
          validationReason: result.reason,
        };
    }
  }
}
