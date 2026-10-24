ALTER TABLE services DROP CONSTRAINT IF EXISTS services_pricing_type_check;
ALTER TABLE services ADD CONSTRAINT services_pricing_type_check
  CHECK (pricing_type IN ('FIXED', 'HOURLY', 'QUOTE_ONLY'));

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_hourly_pricing_check;
ALTER TABLE services ADD CONSTRAINT services_hourly_pricing_check CHECK (
  (pricing_type = 'FIXED' AND hourly_rate_cents IS NULL AND minimum_duration_minutes IS NULL
    AND maximum_duration_minutes IS NULL AND billing_increment_minutes IS NULL AND default_duration_minutes IS NULL)
  OR
  (pricing_type = 'QUOTE_ONLY' AND hourly_rate_cents IS NULL AND minimum_duration_minutes IS NULL
    AND maximum_duration_minutes IS NULL AND billing_increment_minutes IS NULL AND default_duration_minutes IS NULL)
  OR
  (pricing_type = 'HOURLY' AND hourly_rate_cents >= 50 AND minimum_duration_minutes >= 15
    AND billing_increment_minutes IN (15, 30, 60) AND default_duration_minutes >= minimum_duration_minutes
    AND minimum_duration_minutes % billing_increment_minutes = 0
    AND default_duration_minutes % billing_increment_minutes = 0
    AND (maximum_duration_minutes IS NULL OR (maximum_duration_minutes >= default_duration_minutes
      AND maximum_duration_minutes % billing_increment_minutes = 0)))
);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_pricing_type_snapshot_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_pricing_type_snapshot_check
  CHECK (pricing_type_snapshot IN ('FIXED', 'HOURLY', 'QUOTE_ONLY'));

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_hourly_snapshot_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_hourly_snapshot_check CHECK (
  billable_duration_minutes > 0
  AND (actual_duration_minutes IS NULL OR actual_duration_minutes >= 0)
  AND ((pricing_type_snapshot IN ('FIXED', 'QUOTE_ONLY') AND hourly_rate_cents_snapshot IS NULL
    AND billing_increment_minutes_snapshot IS NULL AND minimum_duration_minutes_snapshot IS NULL
    AND maximum_duration_minutes_snapshot IS NULL)
  OR
  (pricing_type_snapshot = 'HOURLY' AND hourly_rate_cents_snapshot >= 50
    AND billable_duration_minutes > 0 AND billing_increment_minutes_snapshot IN (15, 30, 60)
    AND minimum_duration_minutes_snapshot >= 15
    AND billable_duration_minutes >= minimum_duration_minutes_snapshot
    AND billable_duration_minutes % billing_increment_minutes_snapshot = 0
    AND (maximum_duration_minutes_snapshot IS NULL OR billable_duration_minutes <= maximum_duration_minutes_snapshot)))
);
