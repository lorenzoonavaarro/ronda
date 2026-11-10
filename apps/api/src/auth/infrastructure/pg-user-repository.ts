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
  clerk_user_id: string | null;
  created_at: Date;
};

const USER_COLUMNS =
  'id, email, username, display_name, password_hash, clerk_user_id, created_at';

@Injectable()
export class PgUserRepository implements UserRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS}
       FROM users
       WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];

    return row ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS}
       FROM users
       WHERE email = $1`,
      [email],
    );
    const row = result.rows[0];

    return row ? mapUser(row) : null;
  }

  async findByUsername(username: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS}
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
        `INSERT INTO users (
           id, email, username, display_name, password_hash, clerk_user_id, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user.id || randomUUID(),
          user.email,
          user.username,
          user.displayName,
          user.passwordHash,
          user.clerkUserId ?? null,
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

  async findByClerkId(clerkUserId: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS}
       FROM users
       WHERE clerk_user_id = $1`,
      [clerkUserId],
    );
    const row = result.rows[0];

    return row ? mapUser(row) : null;
  }

  async attachClerkId(
    id: string,
    clerkUserId: string,
  ): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET clerk_user_id = $2
       WHERE id = $1
         AND (clerk_user_id IS NULL OR clerk_user_id = $2)
       RETURNING ${USER_COLUMNS}`,
      [id, clerkUserId],
    );
    const row = result.rows[0];

    return row ? mapUser(row) : null;
  }

  async updateProfile(
    id: string,
    profile: { username: string; displayName: string },
  ): Promise<StoredUser> {
    try {
      const result = await this.pool.query<UserRow>(
        `UPDATE users
         SET username = $2, display_name = $3
         WHERE id = $1
         RETURNING ${USER_COLUMNS}`,
        [id, profile.username, profile.displayName],
      );
      const row = result.rows[0];

      if (!row) {
        throw new Error('User profile was not found.');
      }

      return mapUser(row);
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
    clerkUserId: row.clerk_user_id,
    createdAt: row.created_at,
  };
}
