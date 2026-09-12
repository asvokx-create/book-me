ALTER TABLE account_restrictions
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE account_restrictions
  DROP CONSTRAINT IF EXISTS account_restrictions_created_by_fkey;

ALTER TABLE account_restrictions
  ADD CONSTRAINT account_restrictions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE admin_audit_log
  ALTER COLUMN actor_user_id DROP NOT NULL;

ALTER TABLE admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_actor_user_id_fkey;

ALTER TABLE admin_audit_log
  ADD CONSTRAINT admin_audit_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES "user"(id) ON DELETE SET NULL;
