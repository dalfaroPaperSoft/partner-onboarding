import { z } from "zod";

export const ProviderItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

export type ProviderItem = z.infer<typeof ProviderItemSchema>;

export const ValidProviderResponseSchema = z
  .object({
    status: z.literal("valid"),
    items: z.array(ProviderItemSchema),
  })
  .strict();

export const PartialProviderResponseSchema = z
  .object({
    status: z.literal("partial"),
    items: z.array(ProviderItemSchema),
    warnings: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const InvalidProviderResponseSchema = z
  .object({
    status: z.literal("invalid"),
    reason: z.string().min(1),
  })
  .strict();

export const ProviderResponseSchema = z.discriminatedUnion("status", [
  ValidProviderResponseSchema,
  PartialProviderResponseSchema,
  InvalidProviderResponseSchema,
]);

export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;

export const ProviderUnavailableResponseSchema = z
  .object({
    error: z.string().min(1),
  })
  .strict();

export type ProviderUnavailableResponse = z.infer<
  typeof ProviderUnavailableResponseSchema
>;
