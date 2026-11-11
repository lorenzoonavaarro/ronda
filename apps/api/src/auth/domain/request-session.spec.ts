import { describe, expect, it } from '@jest/globals';

import { sessionTokensFrom } from './request-session';

describe('sessionTokensFrom', () => {
  it('keeps a form session when the browser cannot send the site cookie', () => {
    expect(
      sessionTokensFrom({
        bodySession: ' form-token ',
      }),
    ).toEqual(['form-token']);
  });

  it('prefers the bearer token and ignores a blank or huge form value', () => {
    expect(
      sessionTokensFrom({
        authorization: 'Bearer header-token',
        bodySession: ' form-token ',
        cookieToken: 'cookie-token',
      }),
    ).toEqual(['header-token', 'form-token', 'cookie-token']);
    expect(sessionTokensFrom({ bodySession: '   ' })).toEqual([]);
    expect(sessionTokensFrom({ bodySession: 'x'.repeat(12_001) })).toEqual([]);
  });
});
