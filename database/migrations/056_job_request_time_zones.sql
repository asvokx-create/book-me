ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS preferred_time_zone text;

ALTER TABLE job_requests
  DROP CONSTRAINT IF EXISTS job_requests_preferred_time_zone_length;

ALTER TABLE job_requests
  ADD CONSTRAINT job_requests_preferred_time_zone_length
  CHECK (preferred_time_zone IS NULL OR char_length(preferred_time_zone) BETWEEN 3 AND 64);

-- Requests created before this migration were parsed in the UTC app server as
-- if the customer's local wall-clock time were UTC. Reinterpret that wall time
-- in the primary time zone for the service-address state.
WITH request_zones AS (
  SELECT id,
    CASE
      WHEN state IN ('AK') THEN 'America/Anchorage'
      WHEN state IN ('HI') THEN 'Pacific/Honolulu'
      WHEN state IN ('AZ') THEN 'America/Phoenix'
      WHEN state IN ('CA','NV','OR','WA') THEN 'America/Los_Angeles'
      WHEN state IN ('CO','ID','MT','NM','UT','WY') THEN 'America/Denver'
      WHEN state IN ('AL','AR','IA','IL','KS','LA','MN','MS','MO','ND','NE','OK','SD','TN','TX','WI') THEN 'America/Chicago'
      WHEN state IN ('CT','DC','DE','FL','GA','IN','KY','MA','MD','ME','MI','NC','NH','NJ','NY','OH','PA','RI','SC','VA','VT','WV') THEN 'America/New_York'
      WHEN state = 'PR' THEN 'America/Puerto_Rico'
      ELSE 'UTC'
    END AS time_zone
  FROM job_requests
  WHERE preferred_time_zone IS NULL
)
UPDATE job_requests request
SET preferred_starts_at = (request.preferred_starts_at AT TIME ZONE 'UTC') AT TIME ZONE zones.time_zone,
    preferred_time_zone = zones.time_zone
FROM request_zones zones
WHERE request.id = zones.id;
