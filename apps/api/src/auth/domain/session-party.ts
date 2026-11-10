export function sessionPartyAllowed(
  azp: unknown,
  allowed: readonly string[],
): boolean {
  if (typeof azp !== 'string' || azp.trim().length === 0) {
    return true;
  }

  return allowed.includes(azp);
}
