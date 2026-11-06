export class PaypalNotConfiguredError extends Error {
  constructor() {
    super('PayPal is not configured on the server.');
  }
}

export class PaypalIdentityError extends Error {
  constructor() {
    super('PayPal did not confirm this account.');
  }
}

export class PaypalAccountTakenError extends Error {
  constructor() {
    super('That PayPal account is already linked to another member.');
  }
}
