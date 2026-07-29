import type { OnboardingSession } from "@partner-onboarding/contracts";

import { ApiClientError, errorMessage } from "../../../api/client";
import {
  useAcceptPartial,
  useValidateIntegration,
} from "../../../api/onboarding";
import { Alert } from "../components/Alert";
import { ItemList } from "../components/ItemList";

type ValidationStepProps = {
  session: OnboardingSession;
  onEditDetails: () => void;
};

export function ValidationStep({
  session,
  onEditDetails,
}: ValidationStepProps) {
  const validation = useValidateIntegration(session.id);
  const acceptance = useAcceptPartial(session.id);
  const isLocallyValidating = validation.isPending;
  const status = isLocallyValidating ? "pending" : session.validation.status;
  const validationError =
    validation.error instanceof ApiClientError &&
    validation.error.code === "STALE_VALIDATION_RESULT"
      ? null
      : validation.error;

  return (
    <section className="card">
      <div className="eyebrow">Step 2 of 3</div>
      <h2>Validate your Provider connection</h2>
      <p className="section-intro">
        We will securely check the saved credentials and load the items
        available to your account.
      </p>

      {status === "pending" ? (
        <Alert tone="info" title="Checking your connection">
          This usually takes only a moment. You can safely retry after a reload.
        </Alert>
      ) : null}

      {status === "invalid" ? (
        <Alert tone="error" title="Credentials were not accepted">
          {session.validation.reason ?? "Check the credentials and try again."}
        </Alert>
      ) : null}

      {status === "unavailable" ? (
        <Alert tone="warning" title="Provider temporarily unavailable">
          Your credentials were not marked invalid. Retry the connection when
          you are ready.
        </Alert>
      ) : null}

      {status === "partial" ? (
        <>
          <Alert tone="warning" title="Connected with warnings">
            Some Provider data could not be loaded. Review the warnings before
            deciding whether to continue.
          </Alert>
          <div className="result-block">
            <h3>Warnings</h3>
            <ul>
              {session.validation.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
          <div className="result-block">
            <h3>Items found</h3>
            <ItemList items={session.validation.items} />
          </div>
        </>
      ) : null}

      {validationError ? (
        <Alert tone="error" title="Validation request failed">
          {errorMessage(validationError)}
        </Alert>
      ) : null}

      {acceptance.isError ? (
        <Alert tone="error" title="Warnings could not be accepted">
          {errorMessage(acceptance.error)}
        </Alert>
      ) : null}

      <div className="button-row button-row--split">
        <button
          className="button button--secondary"
          type="button"
          onClick={onEditDetails}
          disabled={isLocallyValidating || acceptance.isPending}
        >
          Edit details
        </button>

        <div className="button-row">
          {status === "partial" ? (
            <button
              className="button button--primary"
              type="button"
              onClick={() => acceptance.mutate()}
              disabled={acceptance.isPending || isLocallyValidating}
            >
              {acceptance.isPending
                ? "Accepting…"
                : "Accept warnings and continue"}
            </button>
          ) : null}

          <button
            className={
              status === "not_started"
                ? "button button--primary"
                : "button button--secondary"
            }
            type="button"
            onClick={() => validation.mutate()}
            disabled={isLocallyValidating || acceptance.isPending}
          >
            {isLocallyValidating
              ? "Validating…"
              : status === "not_started"
                ? "Validate connection"
                : "Retry validation"}
          </button>
        </div>
      </div>
    </section>
  );
}
