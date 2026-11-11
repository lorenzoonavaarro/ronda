const MAX_TOKEN_LENGTH = 12_000;

export function sessionTokensFrom(input: {
  authorization?: string;
  cookieToken?: string;
  bodySession?: unknown;
}): string[] {
  const tokens: string[] = [];

  for (const token of [
    bearerToken(input.authorization),
    textToken(input.bodySession),
    textToken(input.cookieToken),
  ]) {
    if (token && !tokens.includes(token)) {
      tokens.push(token);
    }
  }

  return tokens;
}

function textToken(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const token = value.trim();

  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return undefined;
  }

  return token;
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return textToken(match?.[1]);
}
