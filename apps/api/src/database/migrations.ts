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
  {
    id: '004_invites_and_paypal',
    sql: `
      ALTER TABLE circles ADD COLUMN IF NOT EXISTS invite_token text;

      UPDATE circles
      SET invite_token = md5(id::text || random()::text || clock_timestamp()::text)
      WHERE invite_token IS NULL;

      ALTER TABLE circles ALTER COLUMN invite_token SET NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS circles_invite_token_key
        ON circles (invite_token);

      CREATE TABLE IF NOT EXISTS paypal_accounts (
        user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        payer_id text NOT NULL UNIQUE,
        email text,
        full_name text,
        email_verified boolean NOT NULL,
        account_verified boolean NOT NULL,
        account_type text,
        linked_at timestamptz NOT NULL,
        CONSTRAINT paypal_accounts_account_type_check CHECK (
          account_type IS NULL
          OR account_type IN ('PERSONAL', 'BUSINESS', 'PREMIER')
        )
      );
    `,
  },
  {
    id: '005_circle_lock',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'circle_members_payout_position_check'
        ) THEN
          ALTER TABLE circle_members
            ADD CONSTRAINT circle_members_payout_position_check
            CHECK (payout_position IS NULL OR payout_position >= 1);
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS circle_members_payout_position_key
        ON circle_members (circle_id, payout_position)
        WHERE payout_position IS NOT NULL;
    `,
  },
  {
    id: '006_circle_seats',
    sql: `
      ALTER TABLE circles
        ADD COLUMN IF NOT EXISTS members_required integer NOT NULL DEFAULT 6;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'circles_members_required_check'
        ) THEN
          ALTER TABLE circles
            ADD CONSTRAINT circles_members_required_check
            CHECK (members_required BETWEEN 2 AND 12);
        END IF;
      END $$;
    `,
  },
  {
    id: '007_circle_seat_minimum',
    sql: `
      ALTER TABLE circles DROP CONSTRAINT IF EXISTS circles_members_required_check;

      ALTER TABLE circles
        ADD CONSTRAINT circles_members_required_check
        CHECK (members_required BETWEEN 2 AND 12);
    `,
  },
  {
    id: '008_circle_charges',
    sql: `
      ALTER TABLE circles
        ADD COLUMN IF NOT EXISTS charge_day integer NOT NULL DEFAULT 1;

      ALTER TABLE circles
        ADD COLUMN IF NOT EXISTS charges_begin_on date;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'circles_charge_day_check'
        ) THEN
          ALTER TABLE circles
            ADD CONSTRAINT circles_charge_day_check
            CHECK (charge_day BETWEEN 1 AND 28);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS paypal_payment_methods (
        user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        payment_token_id text NOT NULL,
        paypal_customer_id text,
        approved_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS contributions (
        id uuid PRIMARY KEY,
        circle_id uuid NOT NULL REFERENCES circles (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        round_number integer NOT NULL CHECK (round_number >= 1),
        amount_minor integer NOT NULL CHECK (
          amount_minor BETWEEN 100 AND 10000000
        ),
        status text NOT NULL CHECK (
          status IN ('pending', 'paid', 'failed', 'refunded')
        ),
        paypal_order_id text,
        paypal_capture_id text,
        paid_at timestamptz,
        UNIQUE (circle_id, user_id, round_number)
      );

      CREATE TABLE IF NOT EXISTS paypal_webhook_events (
        id text PRIMARY KEY,
        received_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
];
