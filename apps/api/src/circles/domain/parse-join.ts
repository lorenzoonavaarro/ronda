import { InvalidInviteError } from './errors';

export function parseInviteToken(body: unknown): string {
  if (typeof body !== 'object' || body === null) {
    throw new InvalidInviteError();
  }

  const token = 'token' in body ? body.token : undefined;

  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    throw new InvalidInviteError();
  }

  return token;
}
