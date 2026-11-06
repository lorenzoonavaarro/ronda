import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../../database/database.module';
import { PaypalAccountTakenError } from '../domain/errors';
import type { PaypalAccountType } from '../domain/paypal-profile';
import type {
  PaypalRepository,
  StoredPaypalAccount,
} from '../application/ports';

type AccountRow = {
  user_id: string;
  payer_id: string;
  email: string | null;
  full_name: string | null;
  email_verified: boolean;
  account_verified: boolean;
  account_type: PaypalAccountType | null;
  linked_at: Date;
};

@Injectable()
export class PgPaypalRepository implements PaypalRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByUser(userId: string): Promise<StoredPaypalAccount | null> {
    const result = await this.pool.query<AccountRow>(
      `SELECT user_id, payer_id, email, full_name, email_verified,
              account_verified, account_type, linked_at
       FROM paypal_accounts
       WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      payerId: row.payer_id,
      email: row.email,
      fullName: row.full_name,
      emailVerified: row.email_verified,
      accountVerified: row.account_verified,
      accountType: row.account_type,
      linkedAt: row.linked_at,
    };
  }

  async save(account: StoredPaypalAccount): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO paypal_accounts (
           user_id, payer_id, email, full_name, email_verified,
           account_verified, account_type, linked_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO UPDATE SET
           payer_id = EXCLUDED.payer_id,
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           email_verified = EXCLUDED.email_verified,
           account_verified = EXCLUDED.account_verified,
           account_type = EXCLUDED.account_type,
           linked_at = EXCLUDED.linked_at`,
        [
          account.userId,
          account.payerId,
          account.email,
          account.fullName,
          account.emailVerified,
          account.accountVerified,
          account.accountType,
          account.linkedAt,
        ],
      );
    } catch (error) {
      if (isPayerConflict(error)) {
        throw new PaypalAccountTakenError();
      }

      throw error;
    }
  }

  async delete(userId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM paypal_payment_methods WHERE user_id = $1`,
      [userId],
    );
    await this.pool.query(`DELETE FROM paypal_accounts WHERE user_id = $1`, [
      userId,
    ]);
  }
}

function isPayerConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'paypal_accounts_payer_id_key'
  );
}
