import { OnboardingWizard } from "./features/onboarding/OnboardingWizard";
import { ResetSessionButton } from "./features/onboarding/components/ResetSessionButton";

export function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Partner onboarding home">
          <span className="brand__mark">P</span>
          <span>Partner Portal</span>
        </a>
        <div className="site-header__actions">
          <span className="site-header__meta">Self-service onboarding</span>
          <ResetSessionButton />
        </div>
      </header>

      <main className="main-content">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Partner setup</span>
            <h1>Get your account ready</h1>
          </div>
          <p>
            Connect your Provider account, review your items, and go live in a
            few steps.
          </p>
        </div>
        <OnboardingWizard />
      </main>

      <footer className="site-footer">
        Your progress is saved automatically after every successful step.
      </footer>
    </div>
  );
}
