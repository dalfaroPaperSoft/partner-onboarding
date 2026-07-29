import "dotenv/config";

import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default(
      "postgresql://partner:partner@localhost:5432/partner_onboarding?schema=public",
    ),
  PORT: z.coerce.number().int().positive().default(3000),
  PROVIDER_BASE_URL: z.string().url().optional(),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(500),
  TRUSTED_PARTNER_KEY: z.string().min(1).default("trusted-partner"),
});

export const env = EnvSchema.parse(process.env);
