import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../../database/database.module';
import type { SessionRepository, StoredUser } from '../application/ports';

type SessionRow = {
  expires_at: Date;
  id: string;
  email: string;
  username: string;
  display_name: string;
  password_hash: string;
  created_at: Date;
};

@Injectable()
export class PgSessionRepository implements SessionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), input.userId, input.tokenHash, input.expiresAt],
    );
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<{ expiresAt: Date; user: StoredUser } | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT s.expires_at, u.id, u.email, u.username, u.display_name, u.password_hash, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1`,
      [tokenHash],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      expiresAt: row.expires_at,
      user: {
        id: row.id,
        email: row.email,
        username: row.username,
        displayName: row.display_name,
        passwordHash: row.password_hash,
        createdAt: row.created_at,
      },
    };
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [
      tokenHash,
    ]);
  }
}
