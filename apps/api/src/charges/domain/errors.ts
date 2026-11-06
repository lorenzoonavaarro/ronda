export class PaypalPaymentError extends Error {
  constructor(readonly retryable: boolean) {
    super(
      retryable ? 'PayPal did not respond.' : 'PayPal declined the charge.',
    );
  }
}

export class PaypalVaultError extends Error {
  constructor() {
    super('PayPal could not save this payment method.');
  }
}
