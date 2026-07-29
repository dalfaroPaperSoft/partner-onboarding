# Partner Onboarding

A time-boxed full-stack exercise implementing a resumable, three-step partner
onboarding flow with a mock external Provider.

## Technology choices

The stack was selected to maximize type safety and workflow correctness while
keeping setup and framework overhead appropriate for a 4–6 hour exercise.

### Backend

| Technology | Why I chose it |
| --- | --- |
| **Express** | A lightweight framework that stays out of the way. It lets me focus on business logic instead of framework-specific patterns, which is ideal for a time-boxed exercise like this. |
| **Prisma** | Simplifies database access and migrations while providing type-safe queries. It allowed me to model the onboarding entities quickly without writing a lot of boilerplate. |
| **PostgreSQL** | A reliable relational database with excellent transaction support. Since this project requires consistent state transitions and an atomic go-live process, PostgreSQL was a natural choice. |
| **Zod** | Used to validate incoming requests and external Provider responses at runtime. It also integrates with TypeScript by inferring types from validation schemas, reducing duplication. |
| **Vitest** | A fast, modern testing framework with an API similar to Jest. It made it easy to write and run tests without adding unnecessary complexity. |
| **Supertest** | Used to test the Express API by sending HTTP requests directly to the application. It makes integration testing straightforward and helps verify the complete onboarding flow without requiring a separately managed API process. |

### Frontend

| Technology | Why I chose it |
| --- | --- |
| **Vite** | Quick to set up and provides a fast development experience. Given the tight time limit, it lets me spend more time building features instead of configuring the project. |
| **TanStack Query** | Makes communication with the backend straightforward. It handles loading states, errors, cache updates, and refetching, which is useful when creating or resuming a session, validating credentials, and moving through the onboarding flow. |
| **React Hook Form** | Keeps forms simple and easy to manage. It works well for collecting the company name, Provider account ID, and API key without requiring a lot of boilerplate. |
| **Zod** | Validates user input before it is sent to the backend. Sharing Zod schemas and inferred types between the frontend and backend keeps validation and the API contract consistent. |
| **React Testing Library** | Focuses on testing the application the way a user interacts with it. It verifies that the onboarding wizard behaves correctly from filling out details through validation, recovery paths, and go-live completion. |

## Prerequisites

### Node.js

This project uses **Node.js `v24.16.0`**. Use this exact version to keep local
development and test behavior consistent.

Verify the active version:

```bash
node --version
```

Expected output:

```text
v24.16.0
```

### Docker Desktop

**Docker Desktop is a required dependency for local development.** The
application itself runs in the local Node.js environment, but PostgreSQL runs
in a container defined by `docker-compose.yml`. Without a running Docker
engine, the database cannot start and Prisma migrations, API development, and
database-backed tests will fail.

Install Docker Desktop for the local operating system, start it, and wait until
the Docker engine reports that it is running. Docker Compose v2 is included
with current Docker Desktop installations.

Verify Docker and Compose:

```bash
docker --version
docker compose version
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Confirm that the database is healthy:

```bash
docker compose ps
```

The `postgres` service should report `healthy` and expose PostgreSQL on local
port `5432`.

## Session identity

The first version assumes one trusted partner and does not implement
authentication. The API uses the hardcoded identity `trusted-partner` when
handling:

```http
POST /api/onboarding/sessions
```

The identity is stored in `onboarding_sessions.partner_key` with a unique
database index. Repeating the request performs an atomic create-or-resume
operation and returns the same onboarding session, including after API or
database restarts.

### Future improvement: multiple sessions and partners

Multi-partner or multi-session support is intentionally deferred. A future
version should:

- replace the configured hardcoded key with an authenticated partner identity;
- decide whether each partner may have one active session or multiple sessions;
- scope every session read and mutation by both session ID and authenticated
  partner ID;
- use a partial unique index if only one non-completed session is allowed per
  partner;
- add an explicit endpoint for starting another onboarding attempt; and
- add authorization and isolation tests proving one partner cannot access
  another partner's sessions.

The onboarding state machine and Provider integration do not need to change for
that feature; only session ownership and creation/resume selection need to
expand.

## Testing-only session reset

The header includes a **Reset session** action for repeated local testing. After
confirmation, it calls:

```http
POST /api/onboarding/sessions/:sessionId/reset
```

The reset runs in one database transaction and:

- keeps the same `onboarding_sessions` row, ID, and trusted partner identity;
- removes any linked row from `partners`;
- clears company details and Provider credentials;
- clears Provider items, warnings, reasons, and partial acceptance;
- restores `DETAILS_REQUIRED / not_started`;
- clears completion timestamps; and
- advances internal credential and validation counters so an in-flight Provider
  response cannot repopulate the reset session.

After the response, the frontend replaces its cached session and renders the
same empty Details form shown on a fresh start. Repeating create/resume still
returns this one session.

This command is intentionally a local testing convenience. It bypasses the
normal rule that `COMPLETED` is terminal by explicitly deleting the test
Partner and resetting its session. It should be removed or protected by an
environment/authorization guard before any production deployment.

## Local development

Run PostgreSQL, the API, and the frontend in separate terminals.

1. Start PostgreSQL from the repository root:

   ```bash
   docker compose up -d postgres
   ```

2. Install, migrate, and start the API:

   ```bash
   cd apps/api
   npm install
   npm run db:migrate
   npm run db:generate
   npm run dev
   ```

   The API listens on `http://127.0.0.1:3000`. The development command watches
   backend source files and restarts the process when routes or services change.

3. Install and start the frontend:

   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

   Open `http://127.0.0.1:5173`. Vite proxies `/api` requests to the local API,
   so no browser CORS configuration is needed.

## Tests

The test suites focus on the parts that carry the most risk: state transitions,
Provider failure and retry behavior, concurrency and idempotency, shared API
contracts, and the complete user-facing wizard flow.

API integration tests require the PostgreSQL Compose service to be running:

```bash
cd apps/api
npm test
```

Run the frontend wizard tests:

```bash
cd apps/web
npm test
```

Run the shared-contract tests:

```bash
cd packages/contracts
npm test
```

The current suites contain 32 focused tests: 19 API tests, 9 frontend tests,
and 4 shared-contract tests.

### Build and type-check verification

Each package also provides a build command that performs strict TypeScript
validation. The frontend command additionally creates the production bundle.

```bash
cd apps/api
npm run build

cd ../web
npm run build

cd ../../packages/contracts
npm run build
```

The session is intentionally resumable and `COMPLETED` is terminal for the
normal onboarding workflow. To manually exercise another Provider path, use the
testing-only **Reset session** button in the application header. After
confirmation, it clears the current session and linked Partner data while
preserving the same session ID, then returns the wizard to the initial Details
step.

## Mock Provider contract

The Mock Provider runs as an HTTP route in the API server. The onboarding
service must call it over HTTP through the configured `PROVIDER_BASE_URL`; it
must not invoke the mock route handler directly.

### Request

```http
GET /mock-provider/accounts/:accountId/items
Authorization: Bearer <apiKey>
```

Rules:

- `accountId` must be a non-empty path parameter.
- The API key must be sent as a Bearer token.
- The API key selects the deterministic response scenario.
- The API key must never be returned in a response or written to application
  logs.
- The `accountId` should be reflected in item IDs so results are visibly scoped
  to the requested Provider account.

### API-key scenarios

These keys are development and testing fixtures. They are documented here for
developers and are intentionally not displayed in the partner-facing form.

| API key | HTTP behavior | Provider result |
| --- | --- | --- |
| `valid_key` | `200` immediately | Valid credentials with all items |
| `partial_key` | `200` immediately | Partial result with items and warnings |
| `invalid_key` | `200` immediately | Invalid credentials with a safe reason |
| `unavailable_key` | `503` immediately | Provider temporarily unavailable |
| `timeout_key` | Responds after the client timeout | Client maps timeout to unavailable |
| `flaky_key` | First call returns `503`; later calls return `200` valid | Demonstrates a successful retry |
| Missing or unknown key | `200` immediately | Same result as `invalid_key` |

The minimum implementation should prioritize `valid_key`, `partial_key`,
`invalid_key`, and `unavailable_key`. The timeout and flaky scenarios may be
added after the core flows work.

### Valid response

Request:

```http
GET /mock-provider/accounts/account-123/items
Authorization: Bearer valid_key
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "status": "valid",
  "items": [
    {
      "id": "account-123-item-001",
      "name": "Primary catalog item"
    },
    {
      "id": "account-123-item-002",
      "name": "Secondary catalog item"
    }
  ]
}
```

The onboarding service:

- sets `validation_status` to `valid`;
- replaces `provider_items` with the returned items;
- clears prior warnings and validation reasons; and
- moves the session to `READY_TO_GO_LIVE`.

### Partial response

Request:

```http
GET /mock-provider/accounts/account-123/items
Authorization: Bearer partial_key
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "status": "partial",
  "items": [
    {
      "id": "account-123-item-001",
      "name": "Primary catalog item"
    }
  ],
  "warnings": [
    "One Provider item could not be loaded"
  ]
}
```

The onboarding service:

- sets `validation_status` to `partial`;
- replaces `provider_items` and `validation_warnings`;
- clears `partial_accepted_at`;
- keeps the session at `READY_TO_VALIDATE`; and
- moves it to `READY_TO_GO_LIVE` only after the partner explicitly accepts the
  warnings.

### Invalid response

Request:

```http
GET /mock-provider/accounts/account-123/items
Authorization: Bearer invalid_key
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "status": "invalid",
  "reason": "Invalid Provider credentials"
}
```

The onboarding service clears Provider items and warnings, stores the safe
reason, sets `validation_status` to `invalid`, and moves the session to
`INTEGRATION_INVALID`.

Missing, malformed, or unknown API keys produce this same domain response. They
do not expose the received credential.

### Unavailable response

Request:

```http
GET /mock-provider/accounts/account-123/items
Authorization: Bearer unavailable_key
```

Response:

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
```

```json
{
  "error": "Provider temporarily unavailable"
}
```

The onboarding client maps HTTP `503`, timeout, connection failure, and malformed
Provider payloads to `validation_status = unavailable` and session status
`INTEGRATION_UNAVAILABLE`. These failures are transient and validation may be
retried without changing credentials.

### Timeout behavior

For `timeout_key`, the Mock Provider delays its response longer than the
onboarding client's configured timeout. The client aborts the request and maps
the result to `unavailable`. Test timeouts should be short so the automated
suite remains fast.

### Flaky retry behavior

For `flaky_key`, the Mock Provider maintains an in-memory attempt count per
`accountId`:

1. The first call returns HTTP `503`.
2. The second and later calls return the same payload as `valid_key`.

The counter is mock-only and resets when the API process restarts. It exists to
demonstrate that retry can transition an onboarding session from
`INTEGRATION_UNAVAILABLE` to `READY_TO_GO_LIVE`.

### Response validation and persistence

The onboarding HTTP client validates all HTTP `200` payloads with a Zod
discriminated union on `status`. An unexpected or malformed payload is treated
as `unavailable`, not as valid.

Before starting a request, the onboarding service captures
`credentials_version` and increments `validation_attempt`. It applies the
Provider response only if both values still match the session. This prevents an
older or stale HTTP response from overwriting the result of changed credentials
or a newer retry.

Each accepted Provider response atomically replaces stored items, warnings, and
reason fields. Retries never append duplicate items.

## Key assumptions and design decisions

Given the 4–6 hour time limit, I focused on building a small but complete
vertical slice instead of trying to implement every possible feature.

One of the first decisions was to assume a **single trusted partner**, as
allowed by the exercise. Instead of creating a new onboarding session every
time, the API creates or resumes the same session. This keeps the workflow
simple while still demonstrating persistence, resumability, idempotency, and
state management. Supporting multiple users and multiple sessions would have
required authentication and authorization, which are explicitly out of scope.

I also decided to model onboarding as a **state machine**. The backend owns all
state transitions and the frontend simply renders the current state returned by
the API. This avoids duplicating workflow logic across both applications and
makes recovery after page reloads straightforward.

For the database, I intentionally kept the schema small. Provider items and
validation warnings are stored as JSONB instead of normalized tables. While a
normalized model would be more appropriate for reporting or complex queries,
using JSONB significantly reduced implementation time and still satisfied the
requirements for persistence, retries, and resumability.

Another design decision was to implement the Mock Provider as a **real HTTP
API** inside the same Express application. Although it runs in the same process,
the onboarding service communicates with it through HTTP, allowing me to test
timeouts, retries, HTTP errors, and response validation without introducing
additional infrastructure.

Finally, I used a shared contracts package with Zod and TypeScript so both the
frontend and backend rely on the same request and response definitions. This
reduces duplicated models and keeps both sides synchronized as the API evolves.

## What I deliberately deferred

Several features were intentionally left out because they would have added
complexity without providing much value for the objectives of this exercise.

I did not implement authentication or multi-user support since the exercise
explicitly allows assuming a single trusted partner. Similarly, I chose not to
support multiple onboarding sessions per partner because it would require
ownership, authorization rules, and additional UI flows.

I also kept the Provider integration synchronous. Introducing background jobs,
queues, or asynchronous processing would make sense in a production
environment, but it would significantly increase the amount of infrastructure
required for this project.

Provider items were intentionally not normalized into separate tables. The
current implementation is sufficient for the onboarding workflow, and
normalization would only become valuable if those items needed to be queried
independently or reported on.

Finally, I focused testing on the areas that matter most—state transitions,
retry behavior, idempotency, and the onboarding flow—instead of trying to
maximize code coverage.

## What I would do with another day

With another day, my first priority would be implementing authentication and
replacing the hardcoded trusted partner with real user identities. From there,
I would add support for multiple onboarding sessions while ensuring users can
only access their own data.

I would also move the Mock Provider into a separate service to better simulate
an external dependency and add end-to-end tests covering the complete
onboarding journey.

From a production perspective, I would encrypt Provider API keys instead of
storing them directly, improve logging and observability, and add a CI pipeline
to automatically run formatting, type checking, tests, and builds on every
change.

Overall, my goal for this submission was to prioritize correctness, consistency,
and maintainability over completeness. Rather than building many partially
implemented features, I preferred delivering a smaller solution where the core
workflow behaves reliably and can be extended incrementally.
