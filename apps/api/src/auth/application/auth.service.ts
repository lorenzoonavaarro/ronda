import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AuthUser } from '@repo/api';

import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UsernameAlreadyTakenError,
} from '../domain/errors';
import { parseLogin, parseRegistration } from '../domain/parse-auth-input';
import {
  hashSessionToken,
  newSessionToken,
  SESSION_TTL_MS,
} from '../domain/session-token';
import { SupabaseTokenService } from '../infrastructure/supabase-token.service';
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

export type SupabaseIdentity = {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
};

@Injectable()
export class AuthService {
  private dummyPasswordHash: string | null = null;

  clock: () => Date = () => new Date();

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    @Optional() private readonly supabase?: SupabaseTokenService,
  ) {}

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

  async syncSupabaseUser(identity: SupabaseIdentity): Promise<AuthUser> {
    const existing = await this.users.findById(identity.id);

    if (existing) {
      return toAuthUser(existing);
    }

    const username =
      identity.username?.trim().toLowerCase() ||
      `member_${identity.id.replaceAll('-', '').slice(0, 16)}`;
    const displayName = identity.displayName?.trim() || username;
    const user: StoredUser = {
      id: identity.id,
      email: identity.email.trim().toLowerCase(),
      username,
      displayName,
      passwordHash: 'supabase-managed',
      createdAt: this.clock(),
    };

    await this.users.insert(user);
    return toAuthUser(user);
  }

  async authenticateSupabase(accessToken: string): Promise<AuthUser | null> {
    if (!this.supabase) {
      return null;
    }

    const identity = await this.supabase.userForToken(accessToken);

    if (!identity?.id || !identity.email) {
      return null;
    }

    return this.syncSupabaseUser({
      id: identity.id,
      email: identity.email,
      username: metadataString(identity.user_metadata.username),
      displayName: metadataString(identity.user_metadata.display_name),
    });
  }

  async loginWithSupabase(
    body: unknown,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    if (!this.supabase) {
      return null;
    }

    const input = parseLogin(body);
    const user = await this.users.findByUsername(input.username);

    if (!user) {
      return null;
    }

    const session = await this.supabase.signInWithPassword(
      user.email,
      input.password,
    );

    return session
      ? {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        }
      : null;
  }

  async logout(sessionToken: string): Promise<void> {
    await this.sessions.deleteByTokenHash(hashSessionToken(sessionToken));
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

function metadataString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}
