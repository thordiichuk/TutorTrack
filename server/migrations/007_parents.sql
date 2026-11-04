-- parent accounts: read-only access to one child's lessons, notes, homework and payments (tutor's Pro plan)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('tutor','student','parent'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_code text UNIQUE;
CREATE TABLE IF NOT EXISTS student_parents (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, user_id)
);
CREATE INDEX IF NOT EXISTS student_parents_user_idx ON student_parents(user_id);
