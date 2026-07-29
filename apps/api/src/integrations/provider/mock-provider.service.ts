import type {
  ProviderResponse,
  ProviderUnavailableResponse,
} from "@partner-onboarding/contracts";

import { MockProviderRepository } from "./mock-provider.repository.js";

type MockProviderResult =
  | {
      statusCode: 200;
      body: ProviderResponse;
      delayMs?: number;
    }
  | {
      statusCode: 503;
      body: ProviderUnavailableResponse;
      delayMs?: number;
    };

export class MockProviderService {
  constructor(
    private readonly repository: MockProviderRepository,
    private readonly timeoutDelayMs = 1_500,
  ) {}

  getItems(accountId: string, apiKey: string | null): MockProviderResult {
    switch (apiKey) {
      case "valid_key":
        return this.validResult(accountId);
      case "partial_key":
        return {
          statusCode: 200,
          body: {
            status: "partial",
            items: [
              {
                id: `${accountId}-item-001`,
                name: "Primary catalog item",
              },
            ],
            warnings: ["One Provider item could not be loaded"],
          },
        };
      case "unavailable_key":
        return this.unavailableResult();
      case "timeout_key":
        return {
          ...this.validResult(accountId),
          delayMs: this.timeoutDelayMs,
        };
      case "flaky_key":
        return this.repository.nextFlakyAttempt(accountId) === 1
          ? this.unavailableResult()
          : this.validResult(accountId);
      case "invalid_key":
      default:
        return {
          statusCode: 200,
          body: {
            status: "invalid",
            reason: "Invalid Provider credentials",
          },
        };
    }
  }

  private validResult(
    accountId: string,
  ): Extract<MockProviderResult, { statusCode: 200 }> {
    return {
      statusCode: 200,
      body: {
        status: "valid",
        items: [
          {
            id: `${accountId}-item-001`,
            name: "Primary catalog item",
          },
          {
            id: `${accountId}-item-002`,
            name: "Secondary catalog item",
          },
        ],
      },
    };
  }

  private unavailableResult(): Extract<
    MockProviderResult,
    { statusCode: 503 }
  > {
    return {
      statusCode: 503,
      body: {
        error: "Provider temporarily unavailable",
      },
    };
  }
}
