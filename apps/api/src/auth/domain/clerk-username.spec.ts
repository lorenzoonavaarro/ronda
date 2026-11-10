import { describe, expect, it } from '@jest/globals';

import { clerkUsernameCandidates } from './clerk-username';

describe('clerkUsernameCandidates', () => {
  it('keeps a usable Clerk username and offers a suffixed fallback', () => {
    expect(
      clerkUsernameCandidates({
        id: 'user_2abcDEF123456',
        email: 'Ada@Example.com',
        username: 'Ada',
      }),
    ).toEqual(['ada', 'member_123456']);
  });

  it('builds a member name when the email has no usable local part', () => {
    expect(
      clerkUsernameCandidates({
        id: 'user_998877',
        email: '12@example.com',
      }),
    ).toEqual(['member_998877']);
  });
});
