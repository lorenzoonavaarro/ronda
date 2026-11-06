export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_auth',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        email text NOT NULL UNIQUE,
        display_name text NOT NULL,
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    `,
  },
  {
    id: '002_username',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;

      UPDATE users
      SET username = 'member_' || left(replace(id::text, '-', ''), 16)
      WHERE username IS NULL;

      ALTER TABLE users ALTER COLUMN username SET NOT NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
        ) THEN
          ALTER TABLE users
            ADD CONSTRAINT users_username_key UNIQUE (username);
        END IF;
      END $$;
    `,
  },
  {
    id: '003_circles',
    sql: `
      CREATE TABLE IF NOT EXISTS circles (
        id uuid PRIMARY KEY,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        monthly_amount_minor integer NOT NULL CHECK (
          monthly_amount_minor BETWEEN 100 AND 10000000
        ),
        currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
        status text NOT NULL CHECK (status IN ('forming', 'active', 'completed')),
        created_by uuid NOT NULL REFERENCES users (id),
        created_at timestamptz NOT NULL
      );

      CREATE TABLE IF NOT EXISTS circle_members (
        circle_id uuid NOT NULL REFERENCES circles (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        payout_position integer,
        joined_at timestamptz NOT NULL,
        PRIMARY KEY (circle_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS circle_members_user_id_idx
        ON circle_members (user_id);
    `,
  },
];
