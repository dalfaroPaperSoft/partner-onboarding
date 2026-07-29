import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { HttpProviderClient } from "../src/integrations/provider/provider.client.js";
import { createApp } from "../src/app.js";
import { prisma } from "../src/plugins/prisma.js";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

let providerServer: Server;
let providerBaseUrl: string;
const createdSessionIds: string[] = [];
const testPartnerKey = "integration-test-trusted-partner";

beforeAll(async () => {
  providerServer = createApp({ mockTimeoutDelayMs: 100 }).listen(0);
  await new Promise<void>((resolve) =>
    providerServer.once("listening", resolve),
  );
  const address = providerServer.address() as AddressInfo;
  providerBaseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await removeCreatedSessions();
  await prisma.$disconnect();
  await new Promise<void>((resolve, reject) => {
    providerServer.close((error) => (error ? reject(error) : resolve()));
  });
});

afterEach(async () => {
  await removeCreatedSessions();
});

async function removeCreatedSessions(): Promise<void> {
  if (createdSessionIds.length > 0) {
    await prisma.partner.deleteMany({
      where: { onboardingSessionId: { in: createdSessionIds } },
    });
    await prisma.onboardingSession.deleteMany({
      where: { id: { in: createdSessionIds } },
    });
    createdSessionIds.length = 0;
  }
}

describe("Mock Provider HTTP contract", () => {
  it.each([
    ["valid_key", 200, "valid"],
    ["partial_key", 200, "partial"],
    ["invalid_key", 200, "invalid"],
    ["unknown_key", 200, "invalid"],
  ])("maps %s deterministically", async (apiKey, statusCode, status) => {
    const response = await request(providerBaseUrl)
      .get("/mock-provider/accounts/account-123/items")
      .set("authorization", `Bearer ${apiKey}`)
      .expect(statusCode);

    expect(response.body.status).toBe(status);
  });

  it("returns HTTP 503 for unavailable_key", async () => {
    const response = await request(providerBaseUrl)
      .get("/mock-provider/accounts/account-123/items")
      .set("authorization", "Bearer unavailable_key")
      .expect(503);

    expect(response.body).toEqual({
      error: "Provider temporarily unavailable",
    });
  });

  it("maps a timeout to unavailable", async () => {
    const client = new HttpProviderClient(providerBaseUrl, 20);

    await expect(
      client.validateCredentials({
        accountId: "timeout-account",
        apiKey: "timeout_key",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      reason: "Provider temporarily unavailable",
    });
  });

  it("returns unavailable once and valid on a flaky retry", async () => {
    const client = new HttpProviderClient(providerBaseUrl, 200);
    const input = {
      accountId: "flaky-account",
      apiKey: "flaky_key",
    };

    await expect(client.validateCredentials(input)).resolves.toMatchObject({
      status: "unavailable",
    });
    await expect(client.validateCredentials(input)).resolves.toMatchObject({
      status: "valid",
    });
  });
});

describe("Onboarding API", () => {
  const api = () =>
    request(
      createApp({
        providerBaseUrl,
        providerTimeoutMs: 50,
        trustedPartnerKey: testPartnerKey,
      }),
    );

  async function createSession(): Promise<string> {
    const response = await api()
      .post("/api/onboarding/sessions")
      .expect(200);
    createdSessionIds.push(response.body.id);
    return response.body.id as string;
  }

  async function saveDetails(
    sessionId: string,
    providerApiKey: string,
  ): Promise<void> {
    await api()
      .put(`/api/onboarding/sessions/${sessionId}/details`)
      .send({
        companyName: "Example Partner",
        providerAccountId: `account-${sessionId}`,
        providerApiKey,
      })
      .expect(200);
  }

  async function waitForPendingValidation(sessionId: string): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const session = await prisma.onboardingSession.findUniqueOrThrow({
        where: { id: sessionId },
      });
      if (session.validationStatus === "pending") {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    throw new Error("Validation did not enter pending state");
  }

  it("returns the same session for the trusted partner", async () => {
    const first = await api()
      .post("/api/onboarding/sessions")
      .expect(200);
    createdSessionIds.push(first.body.id);

    const second = await api()
      .post("/api/onboarding/sessions")
      .expect(200);

    expect(second.body.id).toBe(first.body.id);
    expect(
      await prisma.onboardingSession.count({
        where: { partnerKey: testPartnerKey },
      }),
    ).toBe(1);
  });

  it("completes the valid flow and makes go-live idempotent", async () => {
    const sessionId = await createSession();
    await saveDetails(sessionId, "valid_key");

    const validation = await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(200);
    expect(validation.body).toMatchObject({
      status: "READY_TO_GO_LIVE",
      currentStep: "review",
      validation: { status: "valid" },
    });
    expect(validation.body.details.providerApiKey).toBeUndefined();

    const firstGoLive = await api()
      .post(`/api/onboarding/sessions/${sessionId}/go-live`)
      .expect(200);
    const secondGoLive = await api()
      .post(`/api/onboarding/sessions/${sessionId}/go-live`)
      .expect(200);

    expect(firstGoLive.body.session.status).toBe("COMPLETED");
    expect(secondGoLive.body.partner.id).toBe(firstGoLive.body.partner.id);
  });

  it("invalidates a successful result when credentials change", async () => {
    const sessionId = await createSession();
    await saveDetails(sessionId, "valid_key");
    await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(200);
    const validated = await prisma.onboardingSession.findUniqueOrThrow({
      where: { id: sessionId },
    });

    const changed = await api()
      .put(`/api/onboarding/sessions/${sessionId}/details`)
      .send({
        companyName: "Example Partner",
        providerAccountId: "replacement-account",
        providerApiKey: "partial_key",
      })
      .expect(200);

    expect(changed.body).toMatchObject({
      status: "READY_TO_VALIDATE",
      currentStep: "validation",
      validation: {
        status: "not_started",
        items: [],
        warnings: [],
        reason: null,
        partialAcceptedAt: null,
      },
    });
    const persisted = await prisma.onboardingSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(persisted.credentialsVersion).toBe(
      validated.credentialsVersion + 1,
    );
    expect(persisted.validationCredentialsVersion).toBeNull();
    expect(persisted.providerItems).toEqual([]);
    expect(persisted.validationWarnings).toEqual([]);
    expect(persisted.validationReason).toBeNull();
    expect(persisted.partialAcceptedAt).toBeNull();
  });

  it("discards an in-flight result after credentials change", async () => {
    const sessionId = await createSession();
    await saveDetails(sessionId, "timeout_key");

    const validationPromise = api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .then((response) => response);
    await waitForPendingValidation(sessionId);

    await api()
      .put(`/api/onboarding/sessions/${sessionId}/details`)
      .send({
        companyName: "Example Partner",
        providerAccountId: "new-account",
        providerApiKey: "valid_key",
      })
      .expect(200);

    const staleResponse = await validationPromise;
    expect(staleResponse.status).toBe(409);
    expect(staleResponse.body.error.code).toBe("STALE_VALIDATION_RESULT");

    const persisted = await prisma.onboardingSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(persisted.providerAccountId).toBe("new-account");
    expect(persisted.providerApiKey).toBe("valid_key");
    expect(persisted.status).toBe("READY_TO_VALIDATE");
    expect(persisted.validationStatus).toBe("not_started");
    expect(persisted.providerItems).toEqual([]);
  });

  it("retries a flaky Provider without duplicating items", async () => {
    const sessionId = await createSession();
    await saveDetails(sessionId, "flaky_key");

    const unavailable = await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(200);
    expect(unavailable.body.validation.status).toBe("unavailable");

    const valid = await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(200);
    const itemIds = valid.body.validation.items.map(
      (item: { id: string }) => item.id,
    );

    expect(valid.body.validation.status).toBe("valid");
    expect(itemIds).toHaveLength(2);
    expect(new Set(itemIds).size).toBe(itemIds.length);
  });

  it("handles concurrent go-live requests with one Partner", async () => {
    const sessionId = await createSession();
    await saveDetails(sessionId, "valid_key");
    await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(200);

    const [first, second] = await Promise.all([
      api().post(`/api/onboarding/sessions/${sessionId}/go-live`),
      api().post(`/api/onboarding/sessions/${sessionId}/go-live`),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.partner.id).toBe(second.body.partner.id);
    expect(
      await prisma.partner.count({
        where: { onboardingSessionId: sessionId },
      }),
    ).toBe(1);
    expect(
      await prisma.onboardingSession.findUniqueOrThrow({
        where: { id: sessionId },
      }),
    ).toMatchObject({ status: "COMPLETED" });
  });

  it("rejects invalid and terminal transitions without changing state", async () => {
    const sessionId = await createSession();

    await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(409);
    await api()
      .post(`/api/onboarding/sessions/${sessionId}/accept-partial`)
      .expect(409);
    expect(
      await prisma.onboardingSession.findUniqueOrThrow({
        where: { id: sessionId },
      }),
    ).toMatchObject({
      status: "DETAILS_REQUIRED",
      validationStatus: "not_started",
    });

    await saveDetails(sessionId, "valid_key");
    await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(200);
    await api()
      .post(`/api/onboarding/sessions/${sessionId}/go-live`)
      .expect(200);

    await api()
      .put(`/api/onboarding/sessions/${sessionId}/details`)
      .send({
        companyName: "Changed Company",
        providerAccountId: "changed-account",
        providerApiKey: "partial_key",
      })
      .expect(409);
    await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(409);
    await api()
      .post(`/api/onboarding/sessions/${sessionId}/accept-partial`)
      .expect(409);

    expect(
      await prisma.onboardingSession.findUniqueOrThrow({
        where: { id: sessionId },
      }),
    ).toMatchObject({
      status: "COMPLETED",
      companyName: "Example Partner",
      validationStatus: "valid",
    });
    expect(
      await prisma.partner.count({
        where: { onboardingSessionId: sessionId },
      }),
    ).toBe(1);
  });

  it("resets the same session and removes its activated partner", async () => {
    const sessionId = await createSession();
    await saveDetails(sessionId, "valid_key");
    await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(200);
    await api()
      .post(`/api/onboarding/sessions/${sessionId}/go-live`)
      .expect(200);

    const reset = await api()
      .post(`/api/onboarding/sessions/${sessionId}/reset`)
      .expect(200);

    expect(reset.body).toMatchObject({
      id: sessionId,
      status: "DETAILS_REQUIRED",
      currentStep: "details",
      details: {
        companyName: null,
        providerAccountId: null,
        hasProviderApiKey: false,
      },
      validation: {
        status: "not_started",
        items: [],
        warnings: [],
        reason: null,
        partialAcceptedAt: null,
      },
      completedAt: null,
    });
    expect(
      await prisma.partner.count({
        where: { onboardingSessionId: sessionId },
      }),
    ).toBe(0);

    const resumed = await api()
      .post("/api/onboarding/sessions")
      .expect(200);
    expect(resumed.body.id).toBe(sessionId);
  });

  it("requires explicit acceptance for a partial result", async () => {
    const sessionId = await createSession();
    await saveDetails(sessionId, "partial_key");

    const validation = await api()
      .post(`/api/onboarding/sessions/${sessionId}/validation`)
      .expect(200);
    expect(validation.body).toMatchObject({
      status: "READY_TO_VALIDATE",
      validation: {
        status: "partial",
        partialAcceptedAt: null,
      },
    });

    await api()
      .post(`/api/onboarding/sessions/${sessionId}/go-live`)
      .expect(409);

    const accepted = await api()
      .post(`/api/onboarding/sessions/${sessionId}/accept-partial`)
      .expect(200);
    expect(accepted.body.status).toBe("READY_TO_GO_LIVE");
    expect(accepted.body.validation.partialAcceptedAt).toBeTruthy();

    await api()
      .post(`/api/onboarding/sessions/${sessionId}/go-live`)
      .expect(200);
  });

  it("allows retry after reloading a persisted pending validation", async () => {
    const sessionId = await createSession();
    await saveDetails(sessionId, "valid_key");
    await prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        status: "READY_TO_VALIDATE",
        validationStatus: "pending",
        validationAttempt: { increment: 1 },
      },
    });

    const resumed = await api()
      .get(`/api/onboarding/sessions/${sessionId}`)
      .expect(200);

    expect(resumed.body.validation.status).toBe("pending");
    expect(resumed.body.allowedActions).toContain("retry_validation");
  });

  it.each([
    ["invalid_key", "INTEGRATION_INVALID", "invalid"],
    ["unavailable_key", "INTEGRATION_UNAVAILABLE", "unavailable"],
  ])(
    "maps %s into the expected onboarding state",
    async (apiKey, sessionStatus, validationStatus) => {
      const sessionId = await createSession();
      await saveDetails(sessionId, apiKey);

      const validation = await api()
        .post(`/api/onboarding/sessions/${sessionId}/validation`)
        .expect(200);

      expect(validation.body.status).toBe(sessionStatus);
      expect(validation.body.validation.status).toBe(validationStatus);
    },
  );
});
