ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES services(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS availability_service_id_idx
  ON availability(service_id, weekday, start_time);
