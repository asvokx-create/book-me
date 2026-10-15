-- Server-side usage ledger for paid Google Places requests. A reservation is
-- intentionally not rolled back after an upstream failure: Google can charge
-- for a request once it has been sent, and this keeps the local guard strict.

CREATE TABLE IF NOT EXISTS google_places_usage_months (
  request_month date NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('text_search_pro')),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_month, request_type)
);
