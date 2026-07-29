import { errorMessage } from "../../../api/client";
import {
  useOnboardingSession,
  useResetSession,
} from "../../../api/onboarding";

export function ResetSessionButton() {
  const sessionQuery = useOnboardingSession();
  const sessionId = sessionQuery.data?.id ?? "";
  const reset = useResetSession(sessionId);

  if (!sessionQuery.data) {
    return null;
  }

  const confirmReset = () => {
    const confirmed = window.confirm(
      "Reset this onboarding session? Company details, Provider credentials, validation results, and any activated partner will be cleared.",
    );

    if (confirmed) {
      reset.mutate();
    }
  };

  return (
    <div className="reset-action">
      {reset.isError ? (
        <span className="reset-action__error" role="alert">
          {errorMessage(reset.error)}
        </span>
      ) : null}
      <button
        className="button button--header"
        type="button"
        onClick={confirmReset}
        disabled={reset.isPending}
      >
        {reset.isPending ? "Resetting…" : "Reset session"}
      </button>
    </div>
  );
}
