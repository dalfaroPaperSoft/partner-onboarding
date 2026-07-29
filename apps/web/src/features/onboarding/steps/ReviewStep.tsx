import type { OnboardingSession } from "@partner-onboarding/contracts";

import { errorMessage } from "../../../api/client";
import {
  useGoLive,
  useValidateIntegration,
} from "../../../api/onboarding";
import { Alert } from "../components/Alert";
import { ItemList } from "../components/ItemList";

type ReviewStepProps = {
  session: OnboardingSession;
  onEditDetails: () => void;
};

export function ReviewStep({ session, onEditDetails }: ReviewStepProps) {
  const goLive = useGoLive(session.id);
  const validation = useValidateIntegration(session.id);
  const isPartial = session.validation.status === "partial";

  return (
    <section className="card">
      <div className="eyebrow">Step 3 of 3</div>
      <h2>Review and go live</h2>
      <p className="section-intro">
        Confirm the company and Provider items below before activating the
        partner account.
      </p>

      {isPartial ? (
        <Alert tone="warning" title="Proceeding with accepted warnings">
          You accepted a partial Provider result. The available items will still
          be activated.
        </Alert>
      ) : (
        <Alert tone="success" title="Provider connection validated">
          Your credentials are valid and the items below are ready.
        </Alert>
      )}

      <dl className="review-details">
        <div>
          <dt>Company</dt>
          <dd>{session.details.companyName}</dd>
        </div>
        <div>
          <dt>Provider account</dt>
          <dd>{session.details.providerAccountId}</dd>
        </div>
      </dl>

      <div className="result-block">
        <h3>Provider items ({session.validation.items.length})</h3>
        <ItemList items={session.validation.items} />
      </div>

      {goLive.isError ? (
        <Alert tone="error" title="Activation could not be confirmed">
          {errorMessage(goLive.error)} The session was refreshed; it is safe to
          try again if it is not already complete.
        </Alert>
      ) : null}

      {validation.isError ? (
        <Alert tone="error" title="Validation could not be restarted">
          {errorMessage(validation.error)}
        </Alert>
      ) : null}

      <div className="button-row button-row--split">
        <div className="button-row">
          <button
            className="button button--secondary"
            type="button"
            onClick={onEditDetails}
            disabled={goLive.isPending || validation.isPending}
          >
            Edit details
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => validation.mutate()}
            disabled={goLive.isPending || validation.isPending}
          >
            {validation.isPending ? "Validating…" : "Validate again"}
          </button>
        </div>

        <button
          className="button button--primary"
          type="button"
          onClick={() => goLive.mutate()}
          disabled={goLive.isPending || validation.isPending}
        >
          {goLive.isPending ? "Going live…" : "Go live"}
        </button>
      </div>
    </section>
  );
}
