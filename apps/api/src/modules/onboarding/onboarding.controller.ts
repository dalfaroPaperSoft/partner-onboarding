import {
  SaveDetailsRequestSchema,
  SessionIdParamsSchema,
} from "@partner-onboarding/contracts";
import type { Request, Response } from "express";

import { OnboardingService } from "./onboarding.service.js";

export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  createSession = async (
    _request: Request,
    response: Response,
  ): Promise<void> => {
    response.json(await this.service.createSession());
  };

  getSession = async (request: Request, response: Response): Promise<void> => {
    const { sessionId } = SessionIdParamsSchema.parse(request.params);
    response.json(await this.service.getSession(sessionId));
  };

  saveDetails = async (request: Request, response: Response): Promise<void> => {
    const { sessionId } = SessionIdParamsSchema.parse(request.params);
    const input = SaveDetailsRequestSchema.parse(request.body);
    response.json(await this.service.saveDetails(sessionId, input));
  };

  validateIntegration = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const { sessionId } = SessionIdParamsSchema.parse(request.params);
    response.json(await this.service.validateIntegration(sessionId));
  };

  acceptPartial = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const { sessionId } = SessionIdParamsSchema.parse(request.params);
    response.json(await this.service.acceptPartial(sessionId));
  };

  goLive = async (request: Request, response: Response): Promise<void> => {
    const { sessionId } = SessionIdParamsSchema.parse(request.params);
    response.json(await this.service.goLive(sessionId));
  };
}
