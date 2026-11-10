import { describe, expect, it } from '@jest/globals';

import { AuthService } from './auth.service';
import type {
  PasswordHasher,
  SessionRepository,
  StoredUser,
  UserRepository,
} from './ports';
import {
  EmailAlreadyRegisteredError,
  InvalidAuthInputError,
  InvalidCredentialsError,
  UsernameAlreadyTakenError,
} from '../domain/errors';
import { ScryptPasswordHasher } from '../infrastructure/scrypt-password-hasher';
import { userInsertConflict } from '../infrastructure/pg-errors';

class MemoryUsers implements UserRepository {
  private readonly byEmail = new Map<string, StoredUser>();
  private readonly byUsername = new Map<string, StoredUser>();

  async findByEmail(email: string): Promise<StoredUser | null> {
    return this.byEmail.get(email) ?? null;
  }

  async findByUsername(username: string): Promise<StoredUser | null> {
    return this.byUsername.get(username) ?? null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    return (
      [...this.byUsername.values()].find((entry) => entry.id === id) ?? null
    );
  }

  async insert(user: StoredUser): Promise<void> {
    if (this.byEmail.has(user.email)) {
      throw new EmailAlreadyRegisteredError();
    }

    if (this.byUsername.has(user.username)) {
      throw new UsernameAlreadyTakenError();
    }

    this.byEmail.set(user.email, user);
    this.byUsername.set(user.username, user);
  }
}

class MemorySessions implements SessionRepository {
  private readonly byHash = new Map<
    string,
    { expiresAt: Date; user: StoredUser }
  >();

  constructor(private readonly users: MemoryUsers) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const user = await this.users.findById(input.userId);

    if (!user) {
      throw new Error('User missing for session');
    }

    this.byHash.set(input.tokenHash, { expiresAt: input.expiresAt, user });
  }

  async findByTokenHash(tokenHash: string) {
    return this.byHash.get(tokenHash) ?? null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.byHash.delete(tokenHash);
  }
}

class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `fake:${password}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    return passwordHash === `fake:${password}`;
  }
}

function createService(now = new Date('2026-01-01T00:00:00Z')) {
  const users = new MemoryUsers();
  const sessions = new MemorySessions(users);
  const service = new AuthService(users, sessions, new FakeHasher());
  service.clock = () => now;
  return { service, setNow: (value: Date) => (service.clock = () => value) };
}

const registration = {
  email: 'Ada@Example.com',
  username: 'Ada',
  password: 'correct-horse',
  displayName: 'Ada',
};

describe('AuthService', () => {
  it('registers a member and starts a session without returning the password', async () => {
    const { service } = createService();
    const result = await service.register(registration);

    expect(result.user).toEqual({
      id: expect.any(String),
      email: 'ada@example.com',
      username: 'ada',
      displayName: 'Ada',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.sessionToken).toEqual(expect.any(String));
    await expect(service.authenticate(result.sessionToken)).resolves.toEqual(
      result.user,
    );
  });

  it('rejects a second account with the same email', async () => {
    const { service } = createService();
    await service.register(registration);

    await expect(
      service.register({
        ...registration,
        username: 'other',
        displayName: 'Other',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it('rejects a second account with the same username', async () => {
    const { service } = createService();
    await service.register(registration);

    await expect(
      service.register({
        ...registration,
        email: 'other@example.com',
        username: ' ADA ',
      }),
    ).rejects.toBeInstanceOf(UsernameAlreadyTakenError);
  });

  it('rejects a short password, a blank name, and a username that is not a handle', async () => {
    const { service } = createService();

    await expect(
      service.register({ ...registration, password: 'short' }),
    ).rejects.toBeInstanceOf(InvalidAuthInputError);
    await expect(
      service.register({ ...registration, displayName: '   ' }),
    ).rejects.toBeInstanceOf(InvalidAuthInputError);
    await expect(
      service.register({ ...registration, username: 'ab' }),
    ).rejects.toBeInstanceOf(InvalidAuthInputError);
    await expect(
      service.register({ ...registration, username: 'ada lovelace' }),
    ).rejects.toBeInstanceOf(InvalidAuthInputError);
  });

  it('logs in with the normalized username', async () => {
    const { service } = createService();
    await service.register(registration);

    const result = await service.login({
      username: ' ADA ',
      password: registration.password,
    });

    expect(result.user.username).toBe('ada');
  });

  it('returns the same error for an unknown username and a wrong password', async () => {
    const { service } = createService();
    await service.register(registration);

    const unknown = service.login({
      username: 'missing',
      password: registration.password,
    });
    const wrong = service.login({
      username: registration.username,
      password: 'wrong-password',
    });

    await expect(unknown).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(wrong).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(unknown).rejects.toThrow(
      'Username or password is incorrect.',
    );
    await expect(wrong).rejects.toThrow('Username or password is incorrect.');
  });

  it('rejects an expired session and a logged-out session', async () => {
    const { service, setNow } = createService(new Date('2026-01-01T00:00:00Z'));
    const result = await service.register(registration);

    setNow(new Date('2026-01-16T00:00:00Z'));
    await expect(service.authenticate(result.sessionToken)).resolves.toBeNull();

    const fresh = await service.login({
      username: registration.username,
      password: registration.password,
    });
    await service.logout(fresh.sessionToken);
    await expect(service.authenticate(fresh.sessionToken)).resolves.toBeNull();
  });
});

describe('userInsertConflict', () => {
  it('maps the username and email unique constraints', () => {
    expect(
      userInsertConflict({ code: '23505', constraint: 'users_username_key' }),
    ).toBeInstanceOf(UsernameAlreadyTakenError);
    expect(
      userInsertConflict({ code: '23505', constraint: 'users_email_key' }),
    ).toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(userInsertConflict({ code: '23505', constraint: 'other' })).toBeNull();
  });
});

describe('ScryptPasswordHasher', () => {
  it('accepts the original password and rejects a different one', async () => {
    const hasher = new ScryptPasswordHasher();
    const passwordHash = await hasher.hash('correct-horse');

    await expect(hasher.verify('correct-horse', passwordHash)).resolves.toBe(
      true,
    );
    await expect(hasher.verify('other-password', passwordHash)).resolves.toBe(
      false,
    );
  });
});
