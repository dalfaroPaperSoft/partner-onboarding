ALTER TABLE onboarding_sessions
ADD COLUMN partner_key TEXT;

WITH ranked_sessions AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at, id) AS position
  FROM onboarding_sessions
)
UPDATE onboarding_sessions AS session
SET partner_key = CASE
  WHEN ranked.position = 1 THEN 'trusted-partner'
  ELSE 'legacy-' || session.id::text
END
FROM ranked_sessions AS ranked
WHERE session.id = ranked.id;

ALTER TABLE onboarding_sessions
ALTER COLUMN partner_key SET DEFAULT 'trusted-partner',
ALTER COLUMN partner_key SET NOT NULL;

CREATE UNIQUE INDEX onboarding_sessions_partner_key_key
ON onboarding_sessions(partner_key);
