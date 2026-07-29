import type { OnboardingSession } from "@partner-onboarding/contracts";

type CompleteStepProps = {
  session: OnboardingSession;
};

export function CompleteStep({ session }: CompleteStepProps) {
  return (
    <section className="card completion">
      <div className="completion__icon" aria-hidden="true">
        ✓
      </div>
      <div className="eyebrow">Onboarding complete</div>
      <h2>{session.details.companyName} is live</h2>
      <p>
        The partner account was activated successfully. Reopening this page will
        return to this confirmation without creating another account.
      </p>
      {session.completedAt ? (
        <small>
          Completed {new Date(session.completedAt).toLocaleString()}
        </small>
      ) : null}
    </section>
  );
}
