import { describe, expect, it } from "vitest";

import {
  OnboardingSessionSchema,
  ProviderResponseSchema,
  SaveDetailsRequestSchema,
} from "./index.js";

describe("ProviderResponseSchema", () => {
  it("accepts all domain outcomes", () => {
    expect(
      ProviderResponseSchema.parse({
        status: "valid",
        items: [{ id: "item-1", name: "Item one" }],
      }).status,
    ).toBe("valid");

    expect(
      ProviderResponseSchema.parse({
        status: "partial",
        items: [],
        warnings: ["One item could not be loaded"],
      }).status,
    ).toBe("partial");

    expect(
      ProviderResponseSchema.parse({
        status: "invalid",
        reason: "Invalid Provider credentials",
      }).status,
    ).toBe("invalid");
  });

  it("rejects a partial result without warnings", () => {
    expect(
      ProviderResponseSchema.safeParse({
        status: "partial",
        items: [],
        warnings: [],
      }).success,
    ).toBe(false);
  });
});

describe("onboarding contracts", () => {
  it("allows an omitted API key when retaining saved credentials", () => {
    expect(
      SaveDetailsRequestSchema.parse({
        companyName: "Partner Inc.",
        providerAccountId: "account-123",
      }),
    ).toEqual({
      companyName: "Partner Inc.",
      providerAccountId: "account-123",
    });
  });

  it("rejects API keys in session responses", () => {
    const result = OnboardingSessionSchema.safeParse({
      id: "c50b0c68-3019-4d3f-aa79-803ee45336f4",
      status: "READY_TO_VALIDATE",
      currentStep: "validation",
      details: {
        companyName: "Partner Inc.",
        providerAccountId: "account-123",
        hasProviderApiKey: true,
        providerApiKey: "must-not-leak",
      },
      validation: {
        status: "not_started",
        items: [],
        warnings: [],
        reason: null,
        partialAcceptedAt: null,
      },
      allowedActions: ["save_details", "validate"],
      createdAt: "2026-07-29T12:00:00.000Z",
      updatedAt: "2026-07-29T12:00:00.000Z",
      completedAt: null,
    });

    expect(result.success).toBe(false);
  });
});
