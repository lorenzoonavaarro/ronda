const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;

export function clerkUsernameCandidates(input: {
  id: string;
  email: string;
  username?: string;
}): string[] {
  const suffix = input.id
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toLowerCase();
  const seeds = [
    input.username,
    input.email.split('@')[0],
    suffix ? `member_${suffix}` : undefined,
  ];
  const names: string[] = [];

  for (const seed of seeds) {
    const name = sanitizeUsername(seed);

    if (name && !names.includes(name)) {
      names.push(name);
    }
  }

  const base = names[0] ?? 'member';
  const withSuffix = sanitizeUsername(
    suffix ? `${base.slice(0, 23)}_${suffix}` : base,
  );

  if (
    withSuffix &&
    !names.includes(withSuffix) &&
    !names.some((name) => name.endsWith(suffix))
  ) {
    names.push(withSuffix);
  }

  return names;
}

function sanitizeUsername(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const name = value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 30);

  return USERNAME_PATTERN.test(name) ? name : null;
}
