export class InvalidCircleInputError extends Error {}

export class InvalidInviteError extends Error {
  constructor() {
    super('Enter an invite link.');
  }
}

export class CircleNotFoundError extends Error {
  constructor() {
    super('Circle not found.');
  }
}

export class CircleFullError extends Error {
  constructor() {
    super('This circle is full.');
  }
}

export class CircleClosedError extends Error {
  constructor() {
    super('This circle is no longer accepting members.');
  }
}

export class CircleForbiddenError extends Error {
  constructor() {
    super('Only the circle creator can change this circle.');
  }
}

export class CircleNotReadyError extends Error {
  constructor() {
    super('This circle locks when every seat is filled.');
  }
}

export class CircleLockedError extends Error {
  constructor() {
    super('This circle is locked.');
  }
}
