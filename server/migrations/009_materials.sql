-- Lesson materials: links and small files (kept in the database), student solutions to homework.
CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,  -- NULL: the student's library
  kind text NOT NULL CHECK (kind IN ('link', 'file')),
  by_student boolean NOT NULL DEFAULT false,                -- a solution uploaded by the student
  name text NOT NULL,
  url text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT '',
  size int NOT NULL DEFAULT 0,
  data bytea,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS materials_student_idx ON materials(student_id);
CREATE INDEX IF NOT EXISTS materials_lesson_idx ON materials(lesson_id) WHERE lesson_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS materials_tutor_idx ON materials(tutor_id);
