export class InvalidTreasurerInputError extends Error {
  constructor() {
    super('Enter a message of up to 2000 characters.');
  }
}

export class TreasurerUnavailableError extends Error {}
