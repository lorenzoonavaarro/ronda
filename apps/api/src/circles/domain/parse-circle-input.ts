import {
  MAX_CIRCLE_SEATS,
  MAX_MONTHLY_AMOUNT_MINOR,
  MIN_CIRCLE_SEATS,
  MIN_MONTHLY_AMOUNT_MINOR,
} from './circle';
import { InvalidCircleInputError } from './errors';

const MAX_NAME_LENGTH = 60;

export type CreateCircleInput = {
  name: string;
  monthlyAmountMinor: number;
  minimumCreditScore: number;
};

export type CircleSettingsInput = CreateCircleInput & {
  membersRequired: number;
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

  const minimumCreditScore = record.minimumCreditScore ?? 0;

  if (
    typeof minimumCreditScore !== 'number' ||
    !Number.isInteger(minimumCreditScore) ||
    minimumCreditScore < 0 ||
    minimumCreditScore > 1000
  ) {
    throw new InvalidCircleInputError(
      'Minimum credit score must be an integer from 0 to 1,000.',
    );
  }

  return { name, monthlyAmountMinor: amount, minimumCreditScore };
}

export function parseCircleSettings(body: unknown): CircleSettingsInput {
  const circle = parseCreateCircle(body);
  const record = body as Record<string, unknown>;
  const seats = record.membersRequired;

  if (
    typeof seats !== 'number' ||
    !Number.isInteger(seats) ||
    seats < MIN_CIRCLE_SEATS ||
    seats > MAX_CIRCLE_SEATS
  ) {
    throw new InvalidCircleInputError('A circle has 2 to 12 seats.');
  }

  return { ...circle, membersRequired: seats };
}
