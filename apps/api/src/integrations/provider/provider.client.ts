import {
  ProviderResponseSchema,
  type ProviderResponse,
} from "@partner-onboarding/contracts";

export type ProviderClientResult =
  | ProviderResponse
  | {
      status: "unavailable";
      reason: string;
    };

export interface ProviderClient {
  validateCredentials(input: {
    accountId: string;
    apiKey: string;
  }): Promise<ProviderClientResult>;
}

export class HttpProviderClient implements ProviderClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async validateCredentials(input: {
    accountId: string;
    apiKey: string;
  }): Promise<ProviderClientResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/mock-provider/accounts/${encodeURIComponent(input.accountId)}/items`,
        {
          headers: {
            authorization: `Bearer ${input.apiKey}`,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );

      if (!response.ok) {
        return this.unavailableResult();
      }

      const parsed = ProviderResponseSchema.safeParse(await response.json());
      return parsed.success ? parsed.data : this.unavailableResult();
    } catch {
      return this.unavailableResult();
    }
  }

  private unavailableResult(): ProviderClientResult {
    return {
      status: "unavailable",
      reason: "Provider temporarily unavailable",
    };
  }
}
