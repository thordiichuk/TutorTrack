-- a cancellation request can also be resolved by moving the lesson one week later
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_cr_status_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_cr_status_check CHECK (cr_status IN ('pending','accepted','rejected','moved'));
