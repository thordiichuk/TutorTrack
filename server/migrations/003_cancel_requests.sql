ALTER TABLE lessons ADD COLUMN cr_status text CHECK (cr_status IN ('pending','accepted','rejected'));
ALTER TABLE lessons ADD COLUMN cr_reason text NOT NULL DEFAULT '';
ALTER TABLE lessons ADD COLUMN cr_note text NOT NULL DEFAULT '';
ALTER TABLE lessons ADD COLUMN cr_at timestamptz;
CREATE INDEX lessons_cr_pending_idx ON lessons(tutor_id) WHERE cr_status = 'pending';
