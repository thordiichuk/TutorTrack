ALTER TABLE users ADD COLUMN blocked_at timestamptz;
ALTER TABLE users ADD COLUMN last_login_at timestamptz;

CREATE TABLE admin_actions (
  id bigserial PRIMARY KEY,
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  admin_email text NOT NULL,
  action text NOT NULL,
  target_email text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_actions_created_idx ON admin_actions(created_at DESC);
