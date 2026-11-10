export type StoredUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  clerkUserId?: string | null;
  createdAt: Date;
};

export interface UserRepository {
  findById(id: string): Promise<StoredUser | null>;
  findByEmail(email: string): Promise<StoredUser | null>;
  findByClerkId(clerkUserId: string): Promise<StoredUser | null>;
  findByUsername(username: string): Promise<StoredUser | null>;
  insert(user: StoredUser): Promise<void>;
  attachClerkId(id: string, clerkUserId: string): Promise<StoredUser | null>;
  updateProfile(
    id: string,
    profile: { username: string; displayName: string },
  ): Promise<StoredUser>;
}

export interface SessionRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findByTokenHash(
    tokenHash: string,
  ): Promise<{ expiresAt: Date; user: StoredUser } | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
