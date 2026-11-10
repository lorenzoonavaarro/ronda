import { describe, expect, it } from '@jest/globals';

import { postgresSsl } from './postgres-ssl';

describe('postgresSsl', () => {
  it('leaves local and Render internal connections unencrypted', () => {
    expect(
      postgresSsl('postgres://ronda:ronda@127.0.0.1:5433/ronda'),
    ).toBeUndefined();
    expect(
      postgresSsl('postgres://user:secret@dpg-abc-a/ronda'),
    ).toBeUndefined();
  });

  it('verifies the certificate on a Render external host', () => {
    expect(
      postgresSsl(
        'postgres://user:secret@dpg-abc-a.oregon-postgres.render.com/ronda',
      ),
    ).toEqual({ rejectUnauthorized: true });
  });

  it('accepts a remote host whose certificate chain Node rejects', () => {
    expect(
      postgresSsl(
        'postgres://user:secret@db.example.com:5432/postgres',
      ),
    ).toEqual({ rejectUnauthorized: false });
  });

  it('honors sslmode=disable', () => {
    expect(
      postgresSsl(
        'postgres://user:secret@dpg-abc-a.oregon-postgres.render.com/ronda?sslmode=disable',
      ),
    ).toBeUndefined();
  });
});
