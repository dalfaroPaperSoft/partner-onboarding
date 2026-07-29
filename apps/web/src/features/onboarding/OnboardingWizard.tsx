import { useState } from "react";

import { errorMessage } from "../../api/client";
import { useOnboardingSession } from "../../api/onboarding";
import { ProgressSteps } from "./components/ProgressSteps";
import { ScreenState } from "./components/ScreenState";
import { CompleteStep } from "./steps/CompleteStep";
import { DetailsStep } from "./steps/DetailsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { ValidationStep } from "./steps/ValidationStep";

export function OnboardingWizard() {
  const sessionQuery = useOnboardingSession();
  const [editingDetails, setEditingDetails] = useState(false);

  if (sessionQuery.isPending) {
    return (
      <ScreenState
        title="Loading your onboarding session"
        message="Checking for saved progress…"
      />
    );
  }

  if (sessionQuery.isError) {
    return (
      <ScreenState
        title="We could not load your session"
        message={errorMessage(sessionQuery.error)}
        actionLabel="Try again"
        onAction={() => void sessionQuery.refetch()}
      />
    );
  }

  const session = sessionQuery.data;
  const visibleStep = editingDetails ? "details" : session.currentStep;

  return (
    <>
      <ProgressSteps currentStep={visibleStep} />

      {visibleStep === "details" ? (
        <DetailsStep
          key={`${session.id}-${session.updatedAt}`}
          session={session}
          canCancel={session.currentStep !== "details"}
          onCancel={() => setEditingDetails(false)}
          onSaved={() => setEditingDetails(false)}
        />
      ) : null}

      {visibleStep === "validation" ? (
        <ValidationStep
          session={session}
          onEditDetails={() => setEditingDetails(true)}
        />
      ) : null}

      {visibleStep === "review" ? (
        <ReviewStep
          session={session}
          onEditDetails={() => setEditingDetails(true)}
        />
      ) : null}

      {visibleStep === "complete" ? <CompleteStep session={session} /> : null}
    </>
  );
}
