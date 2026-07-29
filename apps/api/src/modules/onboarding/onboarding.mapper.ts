import {
  OnboardingSessionSchema,
  ProviderItemSchema,
  type AllowedAction,
  type OnboardingSession,
  type OnboardingStep,
} from "@partner-onboarding/contracts";
import { z } from "zod";

import type { SessionWithPartner } from "./onboarding.repository.js";

const StringArraySchema = z.array(z.string());
const ProviderItemsSchema = z.array(ProviderItemSchema);

export function toSessionResponse(
  session: SessionWithPartner,
): OnboardingSession {
  return OnboardingSessionSchema.parse({
    id: session.id,
    status: session.status,
    currentStep: currentStep(session),
    details: {
      companyName: session.companyName,
      providerAccountId: session.providerAccountId,
      hasProviderApiKey: session.providerApiKey !== null,
    },
    validation: {
      status: session.validationStatus,
      items: ProviderItemsSchema.parse(session.providerItems),
      warnings: StringArraySchema.parse(session.validationWarnings),
      reason: session.validationReason,
      partialAcceptedAt: session.partialAcceptedAt?.toISOString() ?? null,
    },
    allowedActions: allowedActions(session),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
  });
}

function currentStep(session: SessionWithPartner): OnboardingStep {
  if (session.status === "COMPLETED") {
    return "complete";
  }

  if (session.status === "DETAILS_REQUIRED") {
    return "details";
  }

  return session.status === "READY_TO_GO_LIVE" ? "review" : "validation";
}

function allowedActions(session: SessionWithPartner): AllowedAction[] {
  if (session.status === "COMPLETED") {
    return [];
  }

  const actions: AllowedAction[] = ["save_details"];

  if (session.status === "DETAILS_REQUIRED") {
    return actions;
  }

  if (session.status === "READY_TO_GO_LIVE") {
    return [...actions, "retry_validation", "go_live"];
  }

  if (
    session.status === "READY_TO_VALIDATE" &&
    session.validationStatus === "partial" &&
    session.partialAcceptedAt === null
  ) {
    return [...actions, "retry_validation", "accept_partial"];
  }

  if (session.validationStatus === "not_started") {
    return [...actions, "validate"];
  }

  return session.validationStatus === "pending"
    ? actions
    : [...actions, "retry_validation"];
}
