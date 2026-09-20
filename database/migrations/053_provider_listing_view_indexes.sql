CREATE INDEX IF NOT EXISTS analytics_events_service_target_idx
  ON analytics_events(target_id, created_at DESC)
  WHERE event_name = 'service_view' AND target_type = 'service';

CREATE INDEX IF NOT EXISTS analytics_events_service_slug_idx
  ON analytics_events((metadata->>'slug'), created_at DESC)
  WHERE event_name = 'service_view' AND target_id IS NULL;
