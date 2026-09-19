CREATE TABLE IF NOT EXISTS service_demand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  email text NOT NULL,
  service_needed text NOT NULL,
  category text,
  location text NOT NULL,
  radius_miles integer NOT NULL CHECK (radius_miles BETWEEN 1 AND 250),
  consented_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_demand_location_created_idx
  ON service_demand_requests(location, created_at DESC);
CREATE INDEX IF NOT EXISTS service_demand_category_created_idx
  ON service_demand_requests(category, created_at DESC);
