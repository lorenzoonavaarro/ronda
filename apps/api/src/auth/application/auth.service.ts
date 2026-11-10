import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AuthUser } from '@repo/api';
import type { Request } from 'express';

import { clerkUsernameCandidates } from '../domain/clerk-username';
import type { ClerkIdentity } from '../domain/clerk-identity';
import {
  ClerkEmailLinkedError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UsernameAlreadyTakenError,
} from '../domain/errors';
import {
  parseLogin,
  parseProfileUpdate,
  parseRegistration,
} from '../domain/parse-auth-input';
import {
  hashSessionToken,
  newSessionToken,
  SESSION_TTL_MS,
} from '../domain/session-token';
import { ClerkTokenService } from '../infrastructure/clerk-token.service';
import {
  PASSWORD_HASHER,
  SESSION_REPOSITORY,
  USER_REPOSITORY,
  type PasswordHasher,
  type SessionRepository,
  type StoredUser,
  type UserRepository,
} from './ports';

export type AuthResult = {
  user: AuthUser;
  sessionToken: string;
};

@Injectable()
export class AuthService {
  private dummyPasswordHash: string | null = null;

  clock: () => Date = () => new Date();

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    @Optional() private readonly clerk?: ClerkTokenService,
  ) {}

  async userFromRequest(request: Request): Promise<AuthUser | null> {
    if (!this.clerk) {
      return null;
    }

    const identity = await this.clerk.identityFromRequest(request);

    if (!identity) {
      return null;
    }

    return this.syncClerkUser(identity);
  }

  async syncClerkUser(identity: ClerkIdentity): Promise<AuthUser> {
    const email = identity.email.trim().toLowerCase();
    const byClerk = await this.users.findByClerkId(identity.id);

    if (byClerk) {
      return toAuthUser(byClerk);
    }

    const byEmail = await this.users.findByEmail(email);

    if (byEmail) {
      if (byEmail.clerkUserId && byEmail.clerkUserId !== identity.id) {
        throw new ClerkEmailLinkedError();
      }

      const linked = await this.users.attachClerkId(byEmail.id, identity.id);

      if (!linked) {
        throw new ClerkEmailLinkedError();
      }

      return toAuthUser(linked);
    }

    const username = await this.availableUsername(identity);
    const user: StoredUser = {
      id: randomUUID(),
      email,
      username,
      displayName: (identity.displayName?.trim() || username).slice(0, 80),
      passwordHash: 'clerk-managed',
      clerkUserId: identity.id,
      createdAt: this.clock(),
    };

    try {
      await this.users.insert(user);
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        const again = await this.users.findByEmail(email);

        if (
          again &&
          (!again.clerkUserId || again.clerkUserId === identity.id)
        ) {
          const linked = await this.users.attachClerkId(again.id, identity.id);

          if (linked) {
            return toAuthUser(linked);
          }
        }
      }
      throw error;
    }

    return toAuthUser(user);
  }

  private async availableUsername(identity: ClerkIdentity): Promise<string> {
    for (const username of clerkUsernameCandidates(identity)) {
      const taken = await this.users.findByUsername(username);

      if (!taken) {
        return username;
      }
    }

    throw new UsernameAlreadyTakenError();
  }

  async register(body: unknown): Promise<AuthResult> {
    const input = parseRegistration(body);
    const takenUsername = await this.users.findByUsername(input.username);

    if (takenUsername) {
      throw new UsernameAlreadyTakenError();
    }

    const existing = await this.users.findByEmail(input.email);

    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    const user: StoredUser = {
      id: randomUUID(),
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      passwordHash: await this.passwords.hash(input.password),
      createdAt: this.clock(),
    };

    await this.users.insert(user);
    return this.startSession(user);
  }

  async login(body: unknown): Promise<AuthResult> {
    const input = parseLogin(body);
    const user = await this.users.findByUsername(input.username);
    const passwordHash = user
      ? user.passwordHash
      : await this.getDummyPasswordHash();
    const matches = await this.passwords.verify(input.password, passwordHash);

    if (!user || !matches) {
      throw new InvalidCredentialsError();
    }

    return this.startSession(user);
  }

  async authenticate(sessionToken: string): Promise<AuthUser | null> {
    const session = await this.sessions.findByTokenHash(
      hashSessionToken(sessionToken),
    );

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= this.clock().getTime()) {
      await this.sessions.deleteByTokenHash(hashSessionToken(sessionToken));
      return null;
    }

    return toAuthUser(session.user);
  }

  async logout(sessionToken: string): Promise<void> {
    await this.sessions.deleteByTokenHash(hashSessionToken(sessionToken));
  }

  async updateProfile(id: string, body: unknown): Promise<AuthUser> {
    const input = parseProfileUpdate(body);
    const existing = await this.users.findByUsername(input.username);

    if (existing && existing.id !== id) {
      throw new UsernameAlreadyTakenError();
    }

    return toAuthUser(await this.users.updateProfile(id, input));
  }

  private async startSession(user: StoredUser): Promise<AuthResult> {
    const sessionToken = newSessionToken();

    await this.sessions.create({
      userId: user.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: new Date(this.clock().getTime() + SESSION_TTL_MS),
    });

    return { user: toAuthUser(user), sessionToken };
  }

  private async getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= await this.passwords.hash(
      'ronda-dummy-password',
    );
    return this.dummyPasswordHash;
  }
}

function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
  };
}
