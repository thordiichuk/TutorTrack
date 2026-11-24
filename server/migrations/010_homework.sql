-- Homework checking: whether the student should send a solution, and the tutor's check (ok / fix) with a comment.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS hw_submit boolean NOT NULL DEFAULT false;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS hw_check text NOT NULL DEFAULT '' CHECK (hw_check IN ('', 'ok', 'fix'));
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS hw_note text NOT NULL DEFAULT '';
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS hw_checked_at timestamptz;
