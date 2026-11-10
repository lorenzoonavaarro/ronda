import {
  Global,
  Inject,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';

import { migrate } from './migrate';
import { postgresSsl } from './postgres-ssl';

function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    ssl: postgresSsl(connectionString),
  });
}

export const PG_POOL = Symbol('PG_POOL');

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
          throw new Error(
            'DATABASE_URL is not set. Copy ronda/.env.example to ronda/.env.',
          );
        }

        return createPool(connectionString);
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit() {
    try {
      const applied = await migrate(this.pool);

      if (applied.length > 0) {
        console.log(`Applied database migrations: ${applied.join(', ')}`);
      }
    } catch (error) {
      throw new Error(
        'Could not prepare Postgres. Check DATABASE_URL and that the database accepts connections.',
        { cause: error },
      );
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
