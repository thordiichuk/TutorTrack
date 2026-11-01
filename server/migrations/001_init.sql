CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('tutor','student')),
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE password_resets (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false
);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  rate integer NOT NULL CHECK (rate >= 0),
  rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NOT NULL DEFAULT '',
  cancel_mode text NOT NULL DEFAULT 'off' CHECK (cancel_mode IN ('off','percent','fixed')),
  cancel_pct integer NOT NULL DEFAULT 0,
  cancel_fixed integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  invite_code text UNIQUE,
  linked_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX students_tutor_idx ON students(tutor_id);
CREATE INDEX students_linked_idx ON students(linked_user_id);

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  date date NOT NULL,
  time text NOT NULL,
  min integer NOT NULL CHECK (min > 0),
  topic text NOT NULL DEFAULT '',
  prep text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  hw text NOT NULL DEFAULT '',
  hw_due date,
  status text NOT NULL CHECK (status IN ('planned','done','cancelled')),
  paid boolean NOT NULL DEFAULT false,
  amount integer NOT NULL CHECK (amount >= 0),
  fee integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lessons_tutor_idx ON lessons(tutor_id);
CREATE INDEX lessons_student_idx ON lessons(student_id);

CREATE TABLE student_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  cat text NOT NULL DEFAULT 'other',
  repeat text NOT NULL CHECK (repeat IN ('w','o')),
  weekday integer NOT NULL DEFAULT 0,
  date date,
  start_time text NOT NULL,
  end_time text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_events_user_idx ON student_events(user_id);

CREATE TABLE homework_done (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
