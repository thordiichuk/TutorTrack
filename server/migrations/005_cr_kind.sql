-- what the student asks for: cancel the lesson or move it one week later
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS cr_kind text NOT NULL DEFAULT 'cancel' CHECK (cr_kind IN ('cancel','move'));
