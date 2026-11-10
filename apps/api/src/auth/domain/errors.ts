export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('An account with this email already exists.');
  }
}

export class UsernameAlreadyTakenError extends Error {
  constructor() {
    super('That username is already taken.');
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Username or password is incorrect.');
  }
}

export class InvalidAuthInputError extends Error {}

export class ClerkNotConfiguredError extends Error {
  constructor() {
    super(
      'Clerk is not configured. Add CLERK_SECRET_KEY to the API environment.',
    );
  }
}

export class ClerkEmailLinkedError extends Error {
  constructor() {
    super('This email is already linked to another sign-in.');
  }
}
