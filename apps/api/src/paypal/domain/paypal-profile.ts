export type PaypalAccountType = 'PERSONAL' | 'BUSINESS' | 'PREMIER';

export type PaypalProfile = {
  payerId: string;
  fullName: string | null;
  email: string | null;
  emailVerified: boolean;
  accountVerified: boolean;
  accountType: PaypalAccountType | null;
};

export class InvalidPaypalProfileError extends Error {
  constructor() {
    super('PayPal did not share an account id.');
  }
}

const ACCOUNT_TYPES = new Set<PaypalAccountType>([
  'PERSONAL',
  'BUSINESS',
  'PREMIER',
]);

export function parsePaypalProfile(body: unknown): PaypalProfile {
  if (typeof body !== 'object' || body === null) {
    throw new InvalidPaypalProfileError();
  }

  const record = body as Record<string, unknown>;
  const payerId = stringValue(record.user_id) ?? stringValue(record.sub);

  if (!payerId) {
    throw new InvalidPaypalProfileError();
  }

  const accountType = stringValue(record.account_type);
  const given = stringValue(record.given_name);
  const family = stringValue(record.family_name);
  const combined = [given, family].filter(Boolean).join(' ');

  return {
    payerId,
    fullName:
      stringValue(record.name) ?? (combined.length > 0 ? combined : null),
    email: stringValue(record.email),
    emailVerified: flag(record.email_verified),
    accountVerified: flag(record.verified_account),
    accountType:
      accountType && ACCOUNT_TYPES.has(accountType as PaypalAccountType)
        ? (accountType as PaypalAccountType)
        : null,
  };
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function flag(value: unknown): boolean {
  return value === true || value === 'true';
}
