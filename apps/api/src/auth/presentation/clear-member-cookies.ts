import type { Response } from 'express';

import { FLOW_ACTOR_COOKIE } from '../domain/flow-actor';
import { SESSION_COOKIE } from '../domain/session-token';

const MEMBER_COOKIES = [
  SESSION_COOKIE,
  FLOW_ACTOR_COOKIE,
  'ronda_clerk',
  'ronda_paypal_state',
  'ronda_paypal_vault',
  'ronda_paypal_vault_circle',
];

export function clearMemberCookies(response: Response): void {
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };

  for (const name of MEMBER_COOKIES) {
    response.clearCookie(name, options);
  }
}
