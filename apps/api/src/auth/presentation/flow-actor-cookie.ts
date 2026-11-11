import type { Response } from 'express';

import {
  FLOW_ACTOR_COOKIE,
  FLOW_ACTOR_MAX_AGE_MS,
  openFlowActor,
  sealFlowActor,
} from '../domain/flow-actor';
import { readCookie } from './session-cookie';

export function rememberFlowActor(response: Response, userId: string): void {
  const sealed = sealFlowActor(userId, actorSecret());

  if (!sealed) {
    return;
  }

  response.cookie(FLOW_ACTOR_COOKIE, sealed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: FLOW_ACTOR_MAX_AGE_MS,
  });
}

export function flowActorFromRequestCookie(
  cookieHeader: string | undefined,
): string | null {
  const token = readCookie(cookieHeader, FLOW_ACTOR_COOKIE);
  return token ? openFlowActor(token, actorSecret()) : null;
}

export function clearFlowActor(response: Response): void {
  response.clearCookie(FLOW_ACTOR_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

function actorSecret(): string {
  return process.env.CLERK_SECRET_KEY?.trim() ?? '';
}
