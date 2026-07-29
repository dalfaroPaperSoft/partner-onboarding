import {
  SaveDetailsRequestSchema,
  type OnboardingSession,
  type SaveDetailsRequest,
} from "@partner-onboarding/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { errorMessage } from "../../../api/client";
import { useSaveDetails } from "../../../api/onboarding";
import { Alert } from "../components/Alert";

type DetailsStepProps = {
  session: OnboardingSession;
  canCancel: boolean;
  onCancel: () => void;
  onSaved: () => void;
};

export function DetailsStep({
  session,
  canCancel,
  onCancel,
  onSaved,
}: DetailsStepProps) {
  const detailsSchema = SaveDetailsRequestSchema.superRefine((value, context) => {
    if (!session.details.hasProviderApiKey && !value.providerApiKey) {
      context.addIssue({
        code: "custom",
        path: ["providerApiKey"],
        message: "Provider API key is required",
      });
    }
  });
  const mutation = useSaveDetails(session.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SaveDetailsRequest>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      companyName: session.details.companyName ?? "",
      providerAccountId: session.details.providerAccountId ?? "",
      providerApiKey: undefined,
    },
  });

  const submit = handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    onSaved();
  });

  return (
    <section className="card">
      <div className="eyebrow">Step 1 of 3</div>
      <h2>Tell us about your company</h2>
      <p className="section-intro">
        Add your company details and the credentials used to connect to the
        external Provider.
      </p>

      {mutation.isError ? (
        <Alert tone="error" title="Details could not be saved">
          {errorMessage(mutation.error)}
        </Alert>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="companyName">Company name</label>
          <input
            id="companyName"
            autoComplete="organization"
            {...register("companyName")}
            aria-invalid={Boolean(errors.companyName)}
          />
          {errors.companyName ? (
            <small className="field__error">{errors.companyName.message}</small>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="providerAccountId">Provider account ID</label>
          <input
            id="providerAccountId"
            autoComplete="off"
            {...register("providerAccountId")}
            aria-invalid={Boolean(errors.providerAccountId)}
          />
          {errors.providerAccountId ? (
            <small className="field__error">
              {errors.providerAccountId.message}
            </small>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="providerApiKey">Provider API key</label>
          <input
            id="providerApiKey"
            type="password"
            autoComplete="new-password"
            placeholder={
              session.details.hasProviderApiKey
                ? "Leave blank to keep the saved key"
                : undefined
            }
            {...register("providerApiKey", {
              setValueAs: (value: string) => value || undefined,
            })}
            aria-invalid={Boolean(errors.providerApiKey)}
          />
          {errors.providerApiKey ? (
            <small className="field__error">
              {errors.providerApiKey.message}
            </small>
          ) : session.details.hasProviderApiKey ? (
            <small className="field__help">
              A key is saved. Enter a new value only to replace it.
            </small>
          ) : null}
        </div>

        <div className="button-row">
          {canCancel ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={onCancel}
              disabled={mutation.isPending}
            >
              Cancel
            </button>
          ) : null}
          <button
            className="button button--primary"
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </form>
    </section>
  );
}
