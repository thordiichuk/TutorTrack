-- recurring lessons: a series groups lessons created together ("every Tuesday 17:30 until June")
CREATE TABLE IF NOT EXISTS lesson_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  freq int NOT NULL DEFAULT 1 CHECK (freq IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES lesson_series(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS lessons_series_idx ON lessons(series_id) WHERE series_id IS NOT NULL;
