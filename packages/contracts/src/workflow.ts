import { z } from "zod";

export const SessionStatusSchema = z.enum([
  "DETAILS_REQUIRED",
  "READY_TO_VALIDATE",
  "INTEGRATION_INVALID",
  "INTEGRATION_UNAVAILABLE",
  "READY_TO_GO_LIVE",
  "COMPLETED",
]);

export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const ValidationStatusSchema = z.enum([
  "not_started",
  "pending",
  "valid",
  "partial",
  "invalid",
  "unavailable",
]);

export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;

export const OnboardingStepSchema = z.enum([
  "details",
  "validation",
  "review",
  "complete",
]);

export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

export const AllowedActionSchema = z.enum([
  "save_details",
  "validate",
  "retry_validation",
  "accept_partial",
  "go_live",
]);

export type AllowedAction = z.infer<typeof AllowedActionSchema>;
