export class MockProviderRepository {
  private readonly flakyAttempts = new Map<string, number>();

  nextFlakyAttempt(accountId: string): number {
    const attempt = (this.flakyAttempts.get(accountId) ?? 0) + 1;
    this.flakyAttempts.set(accountId, attempt);
    return attempt;
  }

  reset(): void {
    this.flakyAttempts.clear();
  }
}
