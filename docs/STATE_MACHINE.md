# Onboarding State Machine

## Design principle

Avoid one large enum containing every possible combination. Persist a few
orthogonal state dimensions and derive the wizard step and allowed actions from
them.

## Persisted state

### Session lifecycle

```ts
type SessionStatus = "draft" | "completed";
```

`completed` is terminal.

### Integration validation

```ts
type ValidationStatus =
  | "not_started"
  | "pending"
  | "valid"
  | "partial"
  | "invalid"
  | "unavailable";
```

Every validation result is associated with the current `credentialsVersion`.

### Partial-result decision

```ts
type WarningDecision = "not_applicable" | "pending" | "accepted";
```

Only a `partial` result uses `pending` or `accepted`. A new validation attempt
resets this decision.

## Derived wizard step

The backend calculates and returns the current step:

| Condition | Step |
| --- | --- |
| `sessionStatus === "completed"` | Complete confirmation |
| Required details are missing | Details |
| Validation is `not_started`, `pending`, `invalid`, or `unavailable` | Validate integration |
| Validation is `partial` and warnings are not accepted | Validate integration |
| Validation is `valid` | Review and go live |
| Validation is `partial` and warnings are accepted | Review and go live |

The frontend does not independently advance the workflow. It renders the step
and allowed actions returned by the backend.

## Commands and transitions

### Create or resume session

```text
no session -> draft / not_started
existing session -> unchanged
```

- The trusted partner identity has at most one active draft session.
- Repeating the command returns the same session.

### Save details

Allowed when the session is `draft`.

```text
details absent -> details saved
same details -> unchanged
credentials changed -> credentialsVersion + 1
                       validation = not_started
                       items/warnings/reason cleared
                       warningDecision = not_applicable
company name only changed -> validation remains unchanged
```

- `accountId` or `apiKey` changes invalidate the prior validation.
- The API key is accepted on write but never returned in a session response.
- Repeating an identical submission is a no-op.

### Trigger validation

Allowed when the session is `draft` and required details exist.

```text
not_started | invalid | unavailable | pending | valid | partial
    -> pending
    -> valid | partial | invalid | unavailable
```

- Retry is allowed from every validation state, including a stale `pending`.
- Capture `credentialsVersion` before calling the Provider.
- Persist the final result only if the credentials version still matches.
  Otherwise discard the stale Provider response.
- Each completed attempt atomically replaces the items and result metadata for
  that credential version. Provider item identity has a database uniqueness
  constraint, so retry cannot create duplicates.
- Result mapping:
  - `valid`: persist items; clear warnings/reason; warning decision is
    `not_applicable`.
  - `partial`: persist items and warnings; warning decision is `pending`.
  - `invalid`: persist reason; clear items/warnings; warning decision is
    `not_applicable`.
  - `unavailable`: persist a safe error description; clear result data for a
    newly validated credential version; allow retry.

### Accept partial warnings

Allowed when the session is `draft`, validation is `partial`, and the result
matches the current credentials version.

```text
pending -> accepted
accepted -> accepted
```

Repeating the command is a no-op.

### Go live

Allowed only when:

- the session is `draft`;
- required details exist;
- the validation result matches the current credentials version; and
- validation is `valid`, or it is `partial` with warnings `accepted`.

In one PostgreSQL transaction:

```text
lock onboarding session
re-check all guards
insert-or-return the unique partner account
mark partner account live
mark onboarding session completed
commit
```

```text
draft -> completed
completed -> completed
```

Repeating the command returns the existing live account. A unique constraint on
the account's session/partner identity prevents duplicate activation.

## Invalid transitions

Return `409 Conflict` with a stable error code for a command that is valid in
the API but not in the current state, for example:

- validating before details are complete;
- accepting warnings for a non-partial result;
- going live after invalid or unavailable validation;
- going live before partial warnings are accepted;
- changing a completed session.

Return `422 Unprocessable Entity` for malformed or missing input and `404 Not
Found` for an unknown session.

## Concurrency invariants

1. A validation result can authorize go-live only for the credential version it
   validated.
2. At most one partner account exists for the trusted partner/session.
3. Session completion and account activation commit together.
4. A completed session never returns to draft.
5. Retrying any command cannot duplicate provider items or partner accounts.

## API snapshot

Each session response should include:

```ts
type SessionSnapshot = {
  id: string;
  status: SessionStatus;
  currentStep: "details" | "validation" | "review" | "complete";
  details: {
    companyName: string | null;
    accountId: string | null;
    hasApiKey: boolean;
  };
  validation: {
    status: ValidationStatus;
    items: ProviderItem[];
    warnings: string[];
    reason: string | null;
    warningDecision: WarningDecision;
  };
  allowedActions: Array<
    | "save_details"
    | "validate"
    | "retry_validation"
    | "accept_warnings"
    | "go_live"
  >;
};
```

`currentStep` and `allowedActions` are server-derived projections, not separate
mutable workflow state.
