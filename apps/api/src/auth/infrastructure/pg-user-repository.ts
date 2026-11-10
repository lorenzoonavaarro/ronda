import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../../database/database.module';
import type { StoredUser, UserRepository } from '../application/ports';
import { userInsertConflict } from './pg-errors';

type UserRow = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  password_hash: string;
  created_at: Date;
};

@Injectable()
export class PgUserRepository implements UserRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, username, display_name, password_hash, created_at
       FROM users
       WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];

    return row ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, username, display_name, password_hash, created_at
       FROM users
       WHERE email = $1`,
      [email],
    );
    const row = result.rows[0];

    return row ? mapUser(row) : null;
  }

  async findByUsername(username: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, username, display_name, password_hash, created_at
       FROM users
       WHERE username = $1`,
      [username],
    );
    const row = result.rows[0];

    return row ? mapUser(row) : null;
  }

  async insert(user: StoredUser): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO users (id, email, username, display_name, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id || randomUUID(),
          user.email,
          user.username,
          user.displayName,
          user.passwordHash,
          user.createdAt,
        ],
      );
    } catch (error) {
      const conflict = userInsertConflict(error);

      if (conflict) {
        throw conflict;
      }

      throw error;
    }
  }
}

function mapUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}
