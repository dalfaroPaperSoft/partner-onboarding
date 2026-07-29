import type { OnboardingStep } from "@partner-onboarding/contracts";

type ProgressStepsProps = {
  currentStep: OnboardingStep;
};

const steps = [
  { key: "details", label: "Details" },
  { key: "validation", label: "Validate" },
  { key: "review", label: "Review" },
] as const;

const stepPosition: Record<OnboardingStep, number> = {
  details: 0,
  validation: 1,
  review: 2,
  complete: 3,
};

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  const currentPosition = stepPosition[currentStep];

  return (
    <ol className="progress" aria-label="Onboarding progress">
      {steps.map((step, index) => {
        const isComplete = currentPosition > index;
        const isCurrent = currentPosition === index;

        return (
          <li
            className={[
              "progress__step",
              isComplete ? "progress__step--complete" : "",
              isCurrent ? "progress__step--current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={step.key}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="progress__number">
              {isComplete ? "✓" : index + 1}
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
