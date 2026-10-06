CREATE TABLE IF NOT EXISTS admin_expense_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES admin_expenses(id) ON DELETE RESTRICT,
  charge_kind text NOT NULL CHECK (charge_kind IN ('initial', 'renewal')),
  charged_on date NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expense_id, charge_kind, charged_on)
);

CREATE INDEX IF NOT EXISTS admin_expense_charges_charged_on_idx
  ON admin_expense_charges(charged_on DESC);

-- Existing entries represent amounts the admin has already paid.
INSERT INTO admin_expense_charges (expense_id, charge_kind, charged_on, amount_cents)
SELECT id, 'initial', created_at::date, cost_cents
FROM admin_expenses
ON CONFLICT (expense_id, charge_kind, charged_on) DO NOTHING;
