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
        password_hash text NOT NULL DEFAULT 'clerk-managed',
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
  {
    id: '009_credit_events',
    sql: `
      CREATE TABLE IF NOT EXISTS credit_events (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        circle_id uuid NOT NULL REFERENCES circles (id) ON DELETE CASCADE,
        round_number integer NOT NULL CHECK (round_number >= 0),
        event_type text NOT NULL CHECK (
          event_type IN (
            'contribution_paid',
            'contribution_missed',
            'circle_completed',
            'pot_defaulted'
          )
        ),
        points integer NOT NULL CHECK (
          (event_type = 'contribution_paid' AND points = 10)
          OR (event_type = 'contribution_missed' AND points = -15)
          OR (event_type = 'circle_completed' AND points = 20)
          OR (event_type = 'pot_defaulted' AND points = -40)
        ),
        occurred_on date NOT NULL,
        UNIQUE (user_id, circle_id, round_number, event_type)
      );

      INSERT INTO credit_events (
        id, user_id, circle_id, round_number, event_type, points, occurred_on
      )
      SELECT gen_random_uuid(),
             user_id,
             circle_id,
             round_number,
             'contribution_paid',
             10,
             COALESCE((paid_at AT TIME ZONE 'UTC')::date, CURRENT_DATE)
      FROM contributions
      WHERE status = 'paid'
      ON CONFLICT (user_id, circle_id, round_number, event_type) DO NOTHING;

      INSERT INTO credit_events (
        id, user_id, circle_id, round_number, event_type, points, occurred_on
      )
      SELECT gen_random_uuid(),
             user_id,
             circle_id,
             round_number,
             'contribution_missed',
             -15,
             CURRENT_DATE
      FROM contributions
      WHERE status = 'failed'
      ON CONFLICT (user_id, circle_id, round_number, event_type) DO NOTHING;

      INSERT INTO credit_events (
        id, user_id, circle_id, round_number, event_type, points, occurred_on
      )
      SELECT gen_random_uuid(),
             paid.user_id,
             paid.circle_id,
             0,
             'circle_completed',
             20,
             CURRENT_DATE
      FROM (
        SELECT user_id, circle_id, count(*) AS paid_rounds
        FROM contributions
        WHERE status = 'paid'
        GROUP BY user_id, circle_id
      ) AS paid
      JOIN circles ON circles.id = paid.circle_id
      WHERE paid.paid_rounds = circles.members_required
        AND NOT EXISTS (
          SELECT 1
          FROM contributions missed
          WHERE missed.circle_id = paid.circle_id
            AND missed.user_id = paid.user_id
            AND missed.status = 'failed'
        )
      ON CONFLICT (user_id, circle_id, round_number, event_type) DO NOTHING;
    `,
  },
  {
    id: '010_payouts',
    sql: `
      CREATE TABLE IF NOT EXISTS payouts (
        id uuid PRIMARY KEY,
        circle_id uuid NOT NULL REFERENCES circles (id) ON DELETE CASCADE,
        round_number integer NOT NULL CHECK (round_number >= 1),
        creator_id uuid NOT NULL REFERENCES users (id),
        recipient_user_id uuid NOT NULL REFERENCES users (id),
        recipient_email text NOT NULL,
        amount_minor integer NOT NULL CHECK (amount_minor > 0),
        status text NOT NULL CHECK (
          status IN ('pending', 'submitted', 'succeeded', 'failed')
        ),
        paypal_batch_id text UNIQUE,
        paypal_item_id text UNIQUE,
        failure_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (circle_id, round_number)
      );

      CREATE INDEX IF NOT EXISTS payouts_paypal_batch_id_idx
        ON payouts (paypal_batch_id);
    `,
  },
  {
    id: '011_clerk_user',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id text;

      CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_key
        ON users (clerk_user_id);
    `,
  },
  {
    id: '011_clerk_auth',
    sql: `
      ALTER TABLE users
        ALTER COLUMN password_hash SET DEFAULT 'clerk-managed';
    `,
  },
  {
    id: '012_circle_credit_requirements',
    sql: `
      ALTER TABLE circles
        ADD COLUMN IF NOT EXISTS minimum_credit_score integer NOT NULL DEFAULT 0;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'circles_minimum_credit_score_check'
        ) THEN
          ALTER TABLE circles
            ADD CONSTRAINT circles_minimum_credit_score_check
            CHECK (minimum_credit_score BETWEEN 0 AND 1000);
        END IF;
      END $$;
    `,
  },
  {
    id: '013_paper_trading',
    sql: `
      CREATE TABLE IF NOT EXISTS paper_accounts (
        user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        cash_minor integer NOT NULL DEFAULT 0 CHECK (cash_minor >= 0),
        granted_minor integer NOT NULL DEFAULT 0 CHECK (granted_minor >= 0)
      );

      CREATE TABLE IF NOT EXISTS paper_positions (
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        symbol text NOT NULL,
        quantity_e4 integer NOT NULL CHECK (quantity_e4 > 0),
        cost_basis_minor integer NOT NULL CHECK (cost_basis_minor >= 0),
        PRIMARY KEY (user_id, symbol)
      );

      CREATE TABLE IF NOT EXISTS paper_orders (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        symbol text NOT NULL,
        side text NOT NULL CHECK (side IN ('buy', 'sell')),
        quantity_e4 integer NOT NULL CHECK (quantity_e4 > 0),
        price_minor integer NOT NULL CHECK (price_minor > 0),
        notional_minor integer NOT NULL CHECK (notional_minor > 0),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS paper_orders_user_created_idx
        ON paper_orders (user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS payouts_recipient_status_idx
        ON payouts (recipient_user_id, status);
    `,
  },
  {
    id: '014_paper_payout_grants',
    sql: `
      CREATE TABLE IF NOT EXISTS paper_payout_grants (
        payout_id uuid PRIMARY KEY REFERENCES payouts (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        amount_minor integer NOT NULL CHECK (amount_minor > 0),
        granted_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS paper_payout_grants_user_idx
        ON paper_payout_grants (user_id);
    `,
  },
  {
    id: '015_paper_cash_ledger',
    sql: `
      CREATE TABLE IF NOT EXISTS paper_cash_ledger (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        event_key text NOT NULL UNIQUE,
        kind text NOT NULL CHECK (
          kind IN ('payout', 'payout_reversal', 'buy', 'sell')
        ),
        amount_minor integer NOT NULL CHECK (amount_minor <> 0),
        description text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS paper_cash_ledger_user_created_idx
        ON paper_cash_ledger (user_id, created_at DESC);
    `,
  },
];
