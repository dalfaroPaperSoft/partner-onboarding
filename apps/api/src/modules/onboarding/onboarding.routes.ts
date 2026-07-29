import { Router } from "express";

import { asyncHandler } from "../../plugins/async-handler.js";
import { OnboardingController } from "./onboarding.controller.js";

export function createOnboardingRouter(
  controller: OnboardingController,
): Router {
  const router = Router();

  router.post("/sessions", asyncHandler(controller.createSession));
  router.get("/sessions/:sessionId", asyncHandler(controller.getSession));
  router.put(
    "/sessions/:sessionId/details",
    asyncHandler(controller.saveDetails),
  );
  router.post(
    "/sessions/:sessionId/validation",
    asyncHandler(controller.validateIntegration),
  );
  router.post(
    "/sessions/:sessionId/accept-partial",
    asyncHandler(controller.acceptPartial),
  );
  router.post(
    "/sessions/:sessionId/go-live",
    asyncHandler(controller.goLive),
  );

  return router;
}
