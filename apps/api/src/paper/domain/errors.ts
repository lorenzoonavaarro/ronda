export class PaperOrderError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

export function freezeMessage(
  reason: 'missed_contribution' | 'reserve_short' | 'payout_reversed',
): string {
  if (reason === 'missed_contribution') {
    return 'New purchases are paused until your missed contribution is paid.';
  }

  if (reason === 'payout_reversed') {
    return 'New purchases are paused because a PayPal payout was reversed.';
  }

  return 'New purchases are paused because your circles now need a larger reserve.';
}

export function fillMessage(reason: 'cash' | 'shares' | 'notional'): string {
  if (reason === 'cash') {
    return 'That order costs more than your paper cash.';
  }

  if (reason === 'shares') {
    return 'You do not hold enough of that stock.';
  }

  return 'That order is below the smallest paper trade of $0.01.';
}
