import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
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
