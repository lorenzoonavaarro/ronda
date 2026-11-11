import { createHmac, timingSafeEqual } from 'node:crypto';

export const FLOW_ACTOR_COOKIE = 'ronda_flow_actor';
export const FLOW_ACTOR_MAX_AGE_MS = 15 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PayPal sends the browser back to the API host. The Clerk cookie lives on the
// site host, so the return trip carries a short signed member id instead.
export function sealFlowActor(
  userId: string,
  secret: string,
  now = Date.now(),
): string | null {
  if (!UUID.test(userId) || secret.trim().length < 16) {
    return null;
  }

  const payload = `${userId}.${now + FLOW_ACTOR_MAX_AGE_MS}`;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function openFlowActor(
  token: string,
  secret: string,
  now = Date.now(),
): string | null {
  if (secret.trim().length < 16) {
    return null;
  }

  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  const [userId, expText, sig] = parts;

  if (!userId || !expText || !sig || !UUID.test(userId)) {
    return null;
  }

  const exp = Number(expText);

  if (!Number.isInteger(exp) || exp < now) {
    return null;
  }

  const expected = createHmac('sha256', secret)
    .update(`${userId}.${expText}`)
    .digest('base64url');
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expected);

  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return null;
  }

  return userId;
}
