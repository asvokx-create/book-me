ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS provider_deleted_at timestamptz;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS customer_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_deleted_at timestamptz;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_customer_id_provider_id_key;

INSERT INTO conversations (customer_id, provider_id, service_id)
SELECT DISTINCT ON (b.customer_id, b.provider_id, b.service_id)
  b.customer_id, b.provider_id, b.service_id
FROM bookings b
WHERE NOT EXISTS (
  SELECT 1 FROM conversations c
  WHERE c.customer_id = b.customer_id
    AND c.provider_id = b.provider_id
    AND c.service_id = b.service_id
)
ORDER BY b.customer_id, b.provider_id, b.service_id, b.created_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_customer_provider_service_key
  ON conversations(customer_id, provider_id, service_id)
  WHERE service_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_customer_provider_general_key
  ON conversations(customer_id, provider_id)
  WHERE service_id IS NULL;

CREATE INDEX IF NOT EXISTS bookings_provider_visible_idx
  ON bookings(provider_id, starts_at)
  WHERE provider_deleted_at IS NULL;
