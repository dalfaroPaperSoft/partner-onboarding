import express, { type Express } from "express";

import { env } from "./config/env.js";
import { MockProviderController } from "./integrations/provider/mock-provider.controller.js";
import { MockProviderRepository } from "./integrations/provider/mock-provider.repository.js";
import { createMockProviderRouter } from "./integrations/provider/mock-provider.routes.js";
import { MockProviderService } from "./integrations/provider/mock-provider.service.js";
import { HttpProviderClient } from "./integrations/provider/provider.client.js";
import { OnboardingController } from "./modules/onboarding/onboarding.controller.js";
import { OnboardingRepository } from "./modules/onboarding/onboarding.repository.js";
import { createOnboardingRouter } from "./modules/onboarding/onboarding.routes.js";
import { OnboardingService } from "./modules/onboarding/onboarding.service.js";
import { errorHandler, notFoundHandler } from "./plugins/error-handler.js";
import { prisma } from "./plugins/prisma.js";

type AppOptions = {
  providerBaseUrl?: string;
  providerTimeoutMs?: number;
  mockTimeoutDelayMs?: number;
};

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  const mockProviderRepository = new MockProviderRepository();
  const mockProviderService = new MockProviderService(
    mockProviderRepository,
    options.mockTimeoutDelayMs,
  );
  const mockProviderController = new MockProviderController(mockProviderService);

  const providerClient = new HttpProviderClient(
    options.providerBaseUrl ??
      env.PROVIDER_BASE_URL ??
      `http://127.0.0.1:${env.PORT}`,
    options.providerTimeoutMs ?? env.PROVIDER_TIMEOUT_MS,
  );
  const onboardingRepository = new OnboardingRepository(prisma);
  const onboardingService = new OnboardingService(
    onboardingRepository,
    providerClient,
  );
  const onboardingController = new OnboardingController(onboardingService);

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use(
    "/mock-provider",
    createMockProviderRouter(mockProviderController),
  );
  app.use("/api/onboarding", createOnboardingRouter(onboardingController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
