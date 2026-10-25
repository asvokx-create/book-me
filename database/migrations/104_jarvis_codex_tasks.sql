CREATE TABLE IF NOT EXISTS jarvis_codex_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'admin_chat' CHECK (source IN ('admin_chat', 'bug_report', 'phone')),
  source_bug_report_id uuid REFERENCES bug_reports(id) ON DELETE SET NULL,
  source_incident_alert_id uuid REFERENCES jarvis_incident_alerts(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'dispatched', 'completed', 'failed', 'cancelled')),
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  approved_by text REFERENCES "user"(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  dispatched_at timestamptz,
  codex_session_id text,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jarvis_codex_task_approval_consistent CHECK (
    (approved_at IS NULL AND approved_by IS NULL) OR
    (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS jarvis_codex_tasks_status_created_idx
  ON jarvis_codex_tasks(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS jarvis_codex_tasks_open_bug_key
  ON jarvis_codex_tasks(source_bug_report_id)
  WHERE source_bug_report_id IS NOT NULL
    AND status IN ('draft', 'approved', 'dispatched');

CREATE UNIQUE INDEX IF NOT EXISTS jarvis_codex_tasks_open_incident_key
  ON jarvis_codex_tasks(source_incident_alert_id)
  WHERE source_incident_alert_id IS NOT NULL
    AND status IN ('draft', 'approved', 'dispatched');

DROP TRIGGER IF EXISTS jarvis_codex_tasks_set_updated_at ON jarvis_codex_tasks;
CREATE TRIGGER jarvis_codex_tasks_set_updated_at
BEFORE UPDATE ON jarvis_codex_tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
