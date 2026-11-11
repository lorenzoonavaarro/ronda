import { describe, expect, it } from '@jest/globals';

import { sessionParty, sessionPartyAllowed } from './session-party';

const allowed = ['http://localhost:3001', 'http://127.0.0.1:3001'];

describe('sessionPartyAllowed', () => {
  it('accepts a session token that omits the authorized party', () => {
    expect(sessionParty(undefined, allowed)).toBe('absent');
    expect(sessionPartyAllowed(undefined, allowed)).toBe(true);
    expect(sessionPartyAllowed('', allowed)).toBe(true);
  });

  it('accepts the web origins', () => {
    expect(sessionParty('http://localhost:3001', allowed)).toBe('allowed');
    expect(sessionPartyAllowed('http://localhost:3001', allowed)).toBe(true);
  });

  it('rejects another origin in production', () => {
    expect(sessionParty('https://evil.example', allowed)).toBe('unexpected');
    expect(
      sessionPartyAllowed('https://evil.example', allowed, 'production'),
    ).toBe(false);
  });

  it('accepts another origin outside production', () => {
    expect(
      sessionPartyAllowed('https://evil.example', allowed, 'development'),
    ).toBe(true);
    expect(
      sessionPartyAllowed('https://evil.example', allowed, undefined),
    ).toBe(true);
  });
});
