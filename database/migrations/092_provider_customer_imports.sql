-- Provider-owned contacts imported from external systems. These are never marketplace accounts.
CREATE TABLE IF NOT EXISTS provider_imported_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '' CHECK (char_length(first_name) <= 100),
  last_name text NOT NULL DEFAULT '' CHECK (char_length(last_name) <= 100),
  full_name text NOT NULL DEFAULT '' CHECK (char_length(full_name) <= 200),
  email text, email_normalized text, phone text, phone_normalized text,
  service_history text NOT NULL DEFAULT '' CHECK (char_length(service_history) <= 2000),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  last_service_date date,
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_evidence_confirmed_at timestamptz,
  imported_by text REFERENCES "user"(id) ON DELETE SET NULL,
  source_file_name text NOT NULL DEFAULT '' CHECK (char_length(source_file_name) <= 200),
  source_row integer NOT NULL CHECK (source_row > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(btrim(full_name)) > 0 OR email_normalized IS NOT NULL OR phone_normalized IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_imported_customers_email_key ON provider_imported_customers(provider_id,email_normalized) WHERE email_normalized IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS provider_imported_customers_phone_key ON provider_imported_customers(provider_id,phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS provider_imported_customers_provider_search_idx ON provider_imported_customers(provider_id,created_at DESC);
DROP TRIGGER IF EXISTS provider_imported_customers_set_updated_at ON provider_imported_customers;
CREATE TRIGGER provider_imported_customers_set_updated_at BEFORE UPDATE ON provider_imported_customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
