import { Injectable, Logger } from '@nestjs/common';
import {
  createClerkClient,
  verifyToken,
  type ClerkClient,
} from '@clerk/backend';
import type { Request } from 'express';

import type { ClerkIdentity } from '../domain/clerk-identity';
import { ClerkNotConfiguredError } from '../domain/errors';
import {
  sessionParty,
  sessionPartyAllowed,
} from '../domain/session-party';
import { readCookie } from '../presentation/session-cookie';

const RONDA_CLERK_COOKIE = 'ronda_clerk';

@Injectable()
export class ClerkTokenService {
  private readonly logger = new Logger(ClerkTokenService.name);
  private client: ClerkClient | null = null;
  private clientKey: string | null = null;

  async identityFromRequest(request: Request): Promise<ClerkIdentity | null> {
    const secretKey = process.env.CLERK_SECRET_KEY?.trim();

    if (!secretKey) {
      throw new ClerkNotConfiguredError();
    }

    const client = this.clerkClient(secretKey);
    const userId = await this.userIdFromRequest(client, request, secretKey);

    if (!userId) {
      return null;
    }

    try {
      const user = await client.users.getUser(userId);
      const email = primaryEmail(user);

      if (!email) {
        return null;
      }

      const displayName = [user.firstName, user.lastName]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(' ')
        .trim();

      return {
        id: user.id,
        email,
        username: user.username ?? undefined,
        displayName: displayName || undefined,
      };
    } catch (error) {
      this.logger.warn(`Clerk user lookup failed: ${verifyReason(error)}`);
      return null;
    }
  }

  private clerkClient(secretKey: string): ClerkClient {
    if (this.client && this.clientKey === secretKey) {
      return this.client;
    }

    this.client = createClerkClient({
      secretKey,
      publishableKey: firstSet(
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    });
    this.clientKey = secretKey;
    return this.client;
  }

  private async userIdFromRequest(
    client: ClerkClient,
    request: Request,
    secretKey: string,
  ): Promise<string | null> {
    try {
      const state = await client.authenticateRequest(toWebRequest(request), {
        authorizedParties: authorizedParties(),
      });

      if (state.isAuthenticated) {
        const userId = state.toAuth().userId;
        return typeof userId === 'string' ? userId : null;
      }
    } catch {
      // Fall through to an explicit session JWT from the web app.
    }

    for (const token of explicitTokens(request)) {
      try {
        const claims = await verifyToken(token, { secretKey });
        const parties = authorizedParties();

        if (!sessionPartyAllowed(claims.azp, parties)) {
          this.logger.warn('Clerk session rejected: authorized party not allowed');
          continue;
        }

        if (sessionParty(claims.azp, parties) === 'unexpected') {
          this.logger.warn(
            `Clerk session party is outside the web allow-list (${partyOrigin(claims.azp)})`,
          );
        }

        if (typeof claims.sub === 'string' && claims.sub.length > 0) {
          return claims.sub;
        }
      } catch (error) {
        this.logger.warn(`Clerk session rejected: ${verifyReason(error)}`);
      }
    }

    return null;
  }
}

function explicitTokens(request: Request): string[] {
  const tokens: string[] = [];
  const bearer = bearerToken(headerString(request.headers.authorization));
  const cookieToken = readCookie(request.headers.cookie, RONDA_CLERK_COOKIE);

  if (bearer) {
    tokens.push(bearer);
  }

  if (cookieToken && cookieToken !== bearer) {
    tokens.push(cookieToken);
  }

  return tokens;
}

function toWebRequest(request: Request): globalThis.Request {
  const host = headerString(request.headers.host) ?? 'localhost';
  const url = `${request.protocol}://${host}${request.originalUrl || request.url}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    const text = headerString(value);

    if (text) {
      headers.set(key, text);
    }
  }

  const cookieToken = readCookie(request.headers.cookie, RONDA_CLERK_COOKIE);

  if (cookieToken && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${cookieToken}`);
  }

  return new Request(url, { method: request.method, headers });
}

function partyOrigin(azp: unknown): string {
  if (typeof azp !== 'string') {
    return 'missing';
  }

  const trimmed = azp.trim();

  if (/^https?:\/\/\S{1,200}$/.test(trimmed)) {
    return trimmed;
  }

  return 'unrecognized';
}

function authorizedParties(): string[] {
  const origins = new Set(['http://localhost:3001', 'http://127.0.0.1:3001']);
  const configured = process.env.WEB_ORIGIN?.split(',') ?? [];

  for (const origin of configured) {
    const trimmed = origin.trim();

    if (trimmed) {
      origins.add(trimmed);
    }
  }

  return [...origins];
}

function primaryEmail(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
}): string | undefined {
  const primary = user.emailAddresses.find(
    (item) => item.id === user.primaryEmailAddressId,
  );

  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
}

function headerString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function bearerToken(value: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(value ?? '');
  return match?.[1];
}

function verifyReason(error: unknown): string {
  if (error && typeof error === 'object' && 'reason' in error) {
    const reason = error.reason;

    if (typeof reason === 'string' && reason.length > 0) {
      return reason;
    }
  }

  return 'verify-failed';
}

function firstSet(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}
