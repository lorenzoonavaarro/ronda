import type { ConnectionOptions } from 'node:tls';

export function postgresSsl(
  connectionString: string,
): ConnectionOptions | undefined {
  const url = new URL(connectionString);
  const sslmode = url.searchParams.get('sslmode');

  if (sslmode === 'disable') {
    return undefined;
  }

  const hostname = url.hostname;

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    !hostname.includes('.')
  ) {
    return undefined;
  }

  if (hostname.endsWith('.render.com')) {
    return { rejectUnauthorized: true };
  }

  // Some managed Postgres certificate chains are rejected by Node's trust store.
  return { rejectUnauthorized: false };
}
