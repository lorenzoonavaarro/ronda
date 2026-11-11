import { describe, expect, it } from '@jest/globals';

import { openFlowActor, sealFlowActor } from './flow-actor';

const secret = 'test-secret-with-enough-length';
const userId = '11111111-1111-4111-8111-111111111111';

describe('flow actor', () => {
  it('round-trips a member id', () => {
    const sealed = sealFlowActor(userId, secret, 1_000);
    expect(sealed).toBeTruthy();
    expect(openFlowActor(sealed ?? '', secret, 1_000)).toBe(userId);
  });

  it('rejects a tampered member id, a short secret, and an expired seal', () => {
    const sealed = sealFlowActor(userId, secret, 1_000) ?? '';
    const tampered = sealed.replace(
      userId,
      '22222222-2222-4222-8222-222222222222',
    );
    expect(openFlowActor(tampered, secret, 1_000)).toBeNull();
    expect(sealFlowActor(userId, 'short')).toBeNull();
    expect(openFlowActor(sealed, secret, 1_000 + 16 * 60 * 1000)).toBeNull();
  });
});
