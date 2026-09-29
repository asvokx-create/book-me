ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS request_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS opportunity_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS matching_status text NOT NULL DEFAULT 'pending'
    CHECK (matching_status IN ('pending', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS matching_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS matched_provider_count integer NOT NULL DEFAULT 0;

ALTER TABLE job_request_matches
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

UPDATE job_requests request
SET matching_status = 'completed',
    matching_completed_at = COALESCE(request.matching_completed_at, request.created_at),
    matched_provider_count = matches.match_count
FROM (
  SELECT request_id, count(*)::int AS match_count
  FROM job_request_matches
  GROUP BY request_id
) matches
WHERE request.id = matches.request_id AND request.matching_status = 'pending';

UPDATE job_request_matches match
SET conversation_id = conversation.id
FROM conversations conversation, job_requests request
WHERE request.id = match.request_id
  AND conversation.customer_id = request.customer_id
  AND conversation.provider_id = match.provider_id
  AND conversation.service_id = match.service_id
  AND match.conversation_id IS NULL;

CREATE TABLE IF NOT EXISTS job_request_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  job_request_id uuid NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('provider_opportunity')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'skipped', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_request_notification_queue_ready_idx
  ON job_request_notification_queue(status, available_at, created_at)
  WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS job_requests_expiration_idx
  ON job_requests(expires_at)
  WHERE status IN ('open', 'receiving_responses');

CREATE INDEX IF NOT EXISTS job_request_matches_provider_status_idx
  ON job_request_matches(provider_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS services_active_category_idx
  ON services(lower(category), created_at DESC)
  WHERE is_active = true;
