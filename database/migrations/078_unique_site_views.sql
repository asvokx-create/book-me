-- Resolve repeat browser visits to the same signed-in person when possible.
CREATE INDEX IF NOT EXISTS analytics_events_page_view_visitor_idx
  ON analytics_events (anonymous_id, user_id)
  WHERE event_name = 'page_view' AND anonymous_id IS NOT NULL;
