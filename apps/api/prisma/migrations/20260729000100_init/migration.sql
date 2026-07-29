CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_name TEXT,
  provider_account_id TEXT,
  provider_api_key TEXT,

  credentials_version INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'DETAILS_REQUIRED'
    CHECK (status IN (
      'DETAILS_REQUIRED',
      'READY_TO_VALIDATE',
      'INTEGRATION_INVALID',
      'INTEGRATION_UNAVAILABLE',
      'READY_TO_GO_LIVE',
      'COMPLETED'
    )),

  validation_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (validation_status IN (
      'not_started',
      'pending',
      'valid',
      'partial',
      'invalid',
      'unavailable'
    )),

  validation_credentials_version INTEGER,
  validation_attempt INTEGER NOT NULL DEFAULT 0,
  validation_reason TEXT,
  validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  partial_accepted_at TIMESTAMPTZ,
  provider_items JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'LIVE'
    CHECK (status = 'LIVE'),
  onboarding_session_id UUID NOT NULL UNIQUE
    REFERENCES onboarding_sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
