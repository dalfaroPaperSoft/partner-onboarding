import { z } from "zod";

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "ROUTE_NOT_FOUND",
  "SESSION_NOT_FOUND",
  "INVALID_TRANSITION",
  "STALE_VALIDATION_RESULT",
  "PROVIDER_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z
  .object({
    error: z
      .object({
        code: ApiErrorCodeSchema,
        message: z.string().min(1),
        fieldErrors: z.record(z.array(z.string())).optional(),
      })
      .strict(),
  })
  .strict();

export type ApiError = z.infer<typeof ApiErrorSchema>;
