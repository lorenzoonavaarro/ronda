export class PayoutNotReadyError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class PayoutUnavailableError extends Error {
  constructor() {
    super('PayPal payouts are not configured or unavailable.');
  }
}
