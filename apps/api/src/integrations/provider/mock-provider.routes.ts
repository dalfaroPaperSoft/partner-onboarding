import { Router } from "express";

import { asyncHandler } from "../../plugins/async-handler.js";
import { MockProviderController } from "./mock-provider.controller.js";

export function createMockProviderRouter(
  controller: MockProviderController,
): Router {
  const router = Router();

  router.get(
    "/accounts/:accountId/items",
    asyncHandler(controller.getItems),
  );

  return router;
}
