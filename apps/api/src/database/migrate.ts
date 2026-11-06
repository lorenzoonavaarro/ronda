import type { Pool } from 'pg';

import { migrations } from './migrations';

export async function migrate(pool: Pool): Promise<string[]> {
  const applied: string[] = [];

  for (const migration of migrations) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      const existing = await client.query(
        'SELECT id FROM schema_migrations WHERE id = $1',
        [migration.id],
      );

      if (existing.rowCount === 0) {
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [
          migration.id,
        ]);
        applied.push(migration.id);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return applied;
}
