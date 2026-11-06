import { MAX_MONTHLY_AMOUNT_MINOR, MIN_MONTHLY_AMOUNT_MINOR } from './circle';
import { InvalidCircleInputError } from './errors';

const MAX_NAME_LENGTH = 60;

export type CreateCircleInput = {
  name: string;
  monthlyAmountMinor: number;
};

export function parseCreateCircle(body: unknown): CreateCircleInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InvalidCircleInputError(
      'Enter a circle name and a monthly amount.',
    );
  }

  const record = body as Record<string, unknown>;

  if (typeof record.name !== 'string') {
    throw new InvalidCircleInputError('Enter a circle name.');
  }

  const name = record.name.trim();

  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    throw new InvalidCircleInputError('Enter a circle name.');
  }

  const amount = record.monthlyAmountMinor;

  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    throw new InvalidCircleInputError(
      'Monthly amount must be from $1.00 to $100,000.00.',
    );
  }

  if (amount < MIN_MONTHLY_AMOUNT_MINOR || amount > MAX_MONTHLY_AMOUNT_MINOR) {
    throw new InvalidCircleInputError(
      'Monthly amount must be from $1.00 to $100,000.00.',
    );
  }

  return { name, monthlyAmountMinor: amount };
}
