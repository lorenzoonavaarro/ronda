export const MIN_CHARGE_DAY = 1;
export const MAX_CHARGE_DAY = 28;

export function chargeDayFromDate(date: Date): number {
  return Math.min(date.getUTCDate(), MAX_CHARGE_DAY);
}

export function firstChargeOn(from: Date, chargeDay: number): string {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const today = from.getUTCDate();
  const monthIndex = today <= chargeDay ? month : month + 1;

  return utcDate(year, monthIndex, chargeDay);
}

export function addUtcMonths(beginOn: string, months: number): string | null {
  const begin = parseUtcDate(beginOn);

  if (!begin) {
    return null;
  }

  const index = begin.month + months;
  const year = begin.year + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return utcDate(year, month, Math.min(begin.day, lastDay));
}

export function currentRound(
  beginOn: string,
  today: Date,
  seats: number,
): number | null {
  const todayOn = utcDate(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  if (!parseUtcDate(beginOn) || todayOn < beginOn || seats < 1) {
    return null;
  }

  let round = 1;

  while (round < seats) {
    const next = addUtcMonths(beginOn, round);

    if (!next || next > todayOn) {
      break;
    }

    round += 1;
  }

  return round;
}

export function minorToPaypalValue(minor: number): string {
  const whole = Math.trunc(Math.abs(minor) / 100);
  const fraction = String(Math.abs(minor) % 100).padStart(2, '0');

  return `${whole}.${fraction}`;
}

export function paypalValueToMinor(value: string): number | null {
  if (!/^\d+\.\d{2}$/.test(value)) {
    return null;
  }

  const [whole, fraction] = value.split('.');

  if (whole === undefined || fraction === undefined) {
    return null;
  }

  return Number(whole) * 100 + Number(fraction);
}

function utcDate(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function parseUtcDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}
