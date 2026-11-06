export function formatUsd(minor: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(minor / 100);
}

export function minorToDollars(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const fraction = String(Math.abs(minor % 100)).padStart(2, '0');

  return `${whole}.${fraction}`;
}

export function dollarsToMinor(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [whole, fraction = ''] = trimmed.split('.');

  if (whole === undefined) {
    return null;
  }

  const cents =
    Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));

  if (!Number.isSafeInteger(cents)) {
    return null;
  }

  return cents;
}
