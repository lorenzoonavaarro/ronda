export type SessionParty = 'absent' | 'allowed' | 'unexpected';

export function sessionParty(
  azp: unknown,
  allowed: readonly string[],
): SessionParty {
  if (typeof azp !== 'string' || azp.trim().length === 0) {
    return 'absent';
  }

  return allowed.includes(azp) ? 'allowed' : 'unexpected';
}

export function sessionPartyAllowed(
  azp: unknown,
  allowed: readonly string[],
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  const party = sessionParty(azp, allowed);

  if (party !== 'unexpected') {
    return true;
  }

  // Local Clerk session tokens can name an origin outside the web allow-list.
  // Signature and expiry still bind the token to this instance.
  return nodeEnv !== 'production';
}
