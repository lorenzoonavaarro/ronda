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
