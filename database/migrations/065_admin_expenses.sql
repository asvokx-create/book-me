CREATE TABLE IF NOT EXISTS admin_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL CHECK (char_length(trim(service_name)) BETWEEN 1 AND 160),
  notes text NOT NULL DEFAULT '',
  cost_cents integer NOT NULL CHECK (cost_cents > 0),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'one_time')),
  next_renewal_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK (billing_cycle = 'one_time' OR next_renewal_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS admin_expenses_status_renewal_idx
  ON admin_expenses(status, next_renewal_date);

DROP TRIGGER IF EXISTS admin_expenses_set_updated_at ON admin_expenses;
CREATE TRIGGER admin_expenses_set_updated_at
BEFORE UPDATE ON admin_expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
