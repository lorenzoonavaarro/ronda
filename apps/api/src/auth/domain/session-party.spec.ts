import { describe, expect, it } from '@jest/globals';

import { sessionPartyAllowed } from './session-party';

const allowed = ['http://localhost:3001', 'http://127.0.0.1:3001'];

describe('sessionPartyAllowed', () => {
  it('accepts a session token that omits the authorized party', () => {
    expect(sessionPartyAllowed(undefined, allowed)).toBe(true);
    expect(sessionPartyAllowed('', allowed)).toBe(true);
  });

  it('accepts the web origins', () => {
    expect(sessionPartyAllowed('http://localhost:3001', allowed)).toBe(true);
  });

  it('rejects a token minted for another origin', () => {
    expect(sessionPartyAllowed('https://evil.example', allowed)).toBe(false);
  });
});
