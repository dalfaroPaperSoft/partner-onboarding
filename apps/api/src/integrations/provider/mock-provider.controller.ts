import { z } from "zod";
import type { Request, Response } from "express";

import { MockProviderService } from "./mock-provider.service.js";

const ParamsSchema = z
  .object({
    accountId: z.string().trim().min(1),
  })
  .strict();

export class MockProviderController {
  constructor(private readonly service: MockProviderService) {}

  getItems = async (request: Request, response: Response): Promise<void> => {
    const { accountId } = ParamsSchema.parse(request.params);
    const authorization = request.header("authorization");
    const apiKey = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    const result = this.service.getItems(accountId, apiKey);

    if (result.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, result.delayMs));
    }

    response.status(result.statusCode).json(result.body);
  };
}
