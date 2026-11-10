-- Parent access now goes through the child's own student account (code created by the student).
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_code text UNIQUE;
CREATE TABLE IF NOT EXISTS child_parents (
  child_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, parent_id)
);
CREATE INDEX IF NOT EXISTS child_parents_parent_idx ON child_parents(parent_id);
ALTER TABLE student_events ADD COLUMN IF NOT EXISTS hide_parent boolean NOT NULL DEFAULT false;

-- keep existing parent connections where the tutor's student record is linked to a student account
DO $$ BEGIN
  IF to_regclass('student_parents') IS NOT NULL THEN
    INSERT INTO child_parents(child_id, parent_id, created_at)
      SELECT s.linked_user_id, p.user_id, p.created_at FROM student_parents p JOIN students s ON s.id = p.student_id
      WHERE s.linked_user_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    DROP TABLE student_parents;
  END IF;
END $$;
ALTER TABLE students DROP COLUMN IF EXISTS parent_code;
