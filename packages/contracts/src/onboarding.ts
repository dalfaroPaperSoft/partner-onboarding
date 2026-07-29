import { z } from "zod";

import { ProviderItemSchema } from "./provider.js";
import {
  AllowedActionSchema,
  OnboardingStepSchema,
  SessionStatusSchema,
  ValidationStatusSchema,
} from "./workflow.js";

const TimestampSchema = z.string().datetime({ offset: true });

export const SessionIdParamsSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export type SessionIdParams = z.infer<typeof SessionIdParamsSchema>;

export const SaveDetailsRequestSchema = z
  .object({
    companyName: z.string().trim().min(1).max(200),
    providerAccountId: z.string().trim().min(1).max(200),
    providerApiKey: z.string().min(1).max(500).optional(),
  })
  .strict();

export type SaveDetailsRequest = z.infer<typeof SaveDetailsRequestSchema>;

export const SessionDetailsSchema = z
  .object({
    companyName: z.string().nullable(),
    providerAccountId: z.string().nullable(),
    hasProviderApiKey: z.boolean(),
  })
  .strict();

export type SessionDetails = z.infer<typeof SessionDetailsSchema>;

export const SessionValidationSchema = z
  .object({
    status: ValidationStatusSchema,
    items: z.array(ProviderItemSchema),
    warnings: z.array(z.string()),
    reason: z.string().nullable(),
    partialAcceptedAt: TimestampSchema.nullable(),
  })
  .strict();

export type SessionValidation = z.infer<typeof SessionValidationSchema>;

export const OnboardingSessionSchema = z
  .object({
    id: z.string().uuid(),
    status: SessionStatusSchema,
    currentStep: OnboardingStepSchema,
    details: SessionDetailsSchema,
    validation: SessionValidationSchema,
    allowedActions: z.array(AllowedActionSchema),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
  })
  .strict();

export type OnboardingSession = z.infer<typeof OnboardingSessionSchema>;

export const CreateOrResumeSessionResponseSchema = OnboardingSessionSchema;
export type CreateOrResumeSessionResponse = OnboardingSession;

export const GetSessionResponseSchema = OnboardingSessionSchema;
export type GetSessionResponse = OnboardingSession;

export const SaveDetailsResponseSchema = OnboardingSessionSchema;
export type SaveDetailsResponse = OnboardingSession;

export const ValidateIntegrationResponseSchema = OnboardingSessionSchema;
export type ValidateIntegrationResponse = OnboardingSession;

export const AcceptPartialResponseSchema = OnboardingSessionSchema;
export type AcceptPartialResponse = OnboardingSession;

export const PartnerSchema = z
  .object({
    id: z.string().uuid(),
    companyName: z.string().min(1),
    status: z.literal("LIVE"),
    onboardingSessionId: z.string().uuid(),
    createdAt: TimestampSchema,
  })
  .strict();

export type Partner = z.infer<typeof PartnerSchema>;

export const GoLiveResponseSchema = z
  .object({
    session: OnboardingSessionSchema,
    partner: PartnerSchema,
  })
  .strict();

export type GoLiveResponse = z.infer<typeof GoLiveResponseSchema>;
