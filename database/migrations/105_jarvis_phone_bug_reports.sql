ALTER TABLE jarvis_phone_sessions
  ADD COLUMN IF NOT EXISTS actor_user_id text REFERENCES "user"(id) ON DELETE CASCADE;

ALTER TABLE jarvis_codex_tasks
  ADD COLUMN IF NOT EXISTS source_phone_call_sid text;

CREATE UNIQUE INDEX IF NOT EXISTS jarvis_codex_tasks_open_phone_call_key
  ON jarvis_codex_tasks(source_phone_call_sid)
  WHERE source_phone_call_sid IS NOT NULL
    AND status IN ('draft', 'approved', 'dispatched');
