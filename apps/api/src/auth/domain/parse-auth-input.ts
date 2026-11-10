import { InvalidAuthInputError } from './errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;

export type RegistrationInput = {
  email: string;
  username: string;
  password: string;
  displayName: string;
};

export type LoginInput = {
  username: string;
  password: string;
};

export type ProfileUpdateInput = {
  username: string;
  displayName: string;
};

function readRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InvalidAuthInputError('Enter your username and password.');
  }

  return body as Record<string, unknown>;
}

function readEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvalidAuthInputError('Enter a valid email.');
  }

  const email = value.trim().toLowerCase();

  if (
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw new InvalidAuthInputError('Enter a valid email.');
  }

  return email;
}

function readUsername(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvalidAuthInputError('Enter a username.');
  }

  const username = value.trim().toLowerCase();

  if (username.length === 0) {
    throw new InvalidAuthInputError('Enter a username.');
  }

  if (!USERNAME_PATTERN.test(username)) {
    throw new InvalidAuthInputError(
      'Use 3-30 characters: start with a letter, then letters, numbers, or underscores.',
    );
  }

  return username;
}

function readPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw new InvalidAuthInputError('Password must be at least 8 characters.');
  }

  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new InvalidAuthInputError('Password must be at most 128 characters.');
  }

  return value;
}

export function parseRegistration(body: unknown): RegistrationInput {
  const record = readRecord(body);

  if (typeof record.displayName !== 'string') {
    throw new InvalidAuthInputError('Enter your name.');
  }

  const displayName = record.displayName.trim();

  if (displayName.length === 0 || displayName.length > MAX_NAME_LENGTH) {
    throw new InvalidAuthInputError('Enter your name.');
  }

  return {
    email: readEmail(record.email),
    username: readUsername(record.username),
    password: readPassword(record.password),
    displayName,
  };
}

export function parseLogin(body: unknown): LoginInput {
  const record = readRecord(body);

  return {
    username: readUsername(record.username),
    password: readPassword(record.password),
  };
}

export function parseProfileUpdate(body: unknown): ProfileUpdateInput {
  const record = readRecord(body);

  if (typeof record.displayName !== 'string') {
    throw new InvalidAuthInputError('Enter your name.');
  }

  const displayName = record.displayName.trim();

  if (displayName.length === 0 || displayName.length > MAX_NAME_LENGTH) {
    throw new InvalidAuthInputError('Enter your name.');
  }

  return {
    username: readUsername(record.username),
    displayName,
  };
}
