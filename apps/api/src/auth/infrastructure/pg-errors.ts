import {
  EmailAlreadyRegisteredError,
  UsernameAlreadyTakenError,
} from '../domain/errors';

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

export function userInsertConflict(error: unknown): Error | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !isUniqueViolation(error)
  ) {
    return null;
  }

  const constraint =
    'constraint' in error && typeof error.constraint === 'string'
      ? error.constraint
      : null;

  if (constraint === 'users_username_key') {
    return new UsernameAlreadyTakenError();
  }

  if (constraint === 'users_email_key') {
    return new EmailAlreadyRegisteredError();
  }

  return null;
}
