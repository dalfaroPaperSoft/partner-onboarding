# Partner Onboarding

A time-boxed full-stack exercise implementing a resumable, three-step partner
onboarding flow with a mock external Provider.

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
   npm run start
   ```

   The API listens on `http://127.0.0.1:3000`.

3. Install and start the frontend:

   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

   Open `http://127.0.0.1:5173`. Vite proxies `/api` requests to the local API,
   so no browser CORS configuration is needed.

Useful verification commands:

```bash
cd apps/api
npm run build
npm test

cd ../web
npm run build
npm test
```

The session is intentionally resumable and `COMPLETED` is terminal. To manually
exercise another Provider path after completing onboarding, use a fresh local
database or intentionally reset the local development data before starting
again.

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
