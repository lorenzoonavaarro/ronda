import { InvalidTreasurerInputError } from './errors';

const MESSAGE_MAX = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TreasurerAsk = {
  message: string;
  circleId: string | null;
};

export function parseTreasurerAsk(body: unknown): TreasurerAsk {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidTreasurerInputError();
  }

  const record = body as Record<string, unknown>;

  if (typeof record.message !== 'string') {
    throw new InvalidTreasurerInputError();
  }

  const message = record.message.trim();

  if (message.length === 0 || message.length > MESSAGE_MAX) {
    throw new InvalidTreasurerInputError();
  }

  if (record.circleId === undefined || record.circleId === null) {
    return { message, circleId: null };
  }

  if (typeof record.circleId !== 'string' || !UUID.test(record.circleId)) {
    throw new InvalidTreasurerInputError();
  }

  return { message, circleId: record.circleId };
}
