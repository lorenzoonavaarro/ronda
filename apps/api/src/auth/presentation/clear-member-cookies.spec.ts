import { describe, expect, it } from '@jest/globals';
import type { CookieOptions, Response } from 'express';

import { clearMemberCookies } from './clear-member-cookies';

describe('clearMemberCookies', () => {
  it('expires every cookie that can carry a member session', () => {
    const cleared: { name: string; options: CookieOptions }[] = [];
    const response = {
      clearCookie(name: string, options: CookieOptions) {
        cleared.push({ name, options });
      },
    };

    clearMemberCookies(response as Response);

    expect(cleared.map((cookie) => cookie.name)).toEqual([
      'ronda_session',
      'ronda_flow_actor',
      'ronda_clerk',
      'ronda_paypal_state',
      'ronda_paypal_vault',
      'ronda_paypal_vault_circle',
    ]);
    expect(cleared.every((cookie) => cookie.options.httpOnly)).toBe(true);
    expect(cleared.every((cookie) => cookie.options.path === '/')).toBe(true);
  });
});
