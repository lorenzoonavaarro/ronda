const HOLD_DAYS = 7;
const DAY_MS = 86_400_000;

export type YieldMemberInput = {
  displayName: string;
  username: string;
  payoutPosition: number | null;
  contributionStatus: 'paid' | 'due' | 'not_due' | 'failed' | 'refunded';
};

export type YieldRoundView = {
  number: number;
  chargeOn: string;
  payoutOn: string;
  potMinor: number;
  days: number;
  interestMinor: number;
  state: 'not_started' | 'earning' | 'posted';
};

export type YieldShareView = {
  displayName: string;
  username: string;
  payoutPosition: number | null;
  amountMinor: number;
};

export type YieldProjection = {
  rounds: YieldRoundView[];
  earningMinor: number;
  availableMinor: number;
  splitReady: boolean;
  splitOn: string | null;
  shares: YieldShareView[];
};

export function projectCircleYield(input: {
  chargesBeginOn: string;
  monthlyAmountMinor: number;
  membersRequired: number;
  asOf: string;
  members: YieldMemberInput[];
}): YieldProjection | null {
  if (!isUtcDate(input.chargesBeginOn) || !isUtcDate(input.asOf)) {
    return null;
  }

  if (input.membersRequired < 1 || input.monthlyAmountMinor < 0) {
    return null;
  }

  const potMinor = input.monthlyAmountMinor * input.membersRequired;
  const rounds: YieldRoundView[] = [];

  for (let number = 1; number <= input.membersRequired; number += 1) {
    const chargeOn = addUtcMonths(input.chargesBeginOn, number - 1);
    const payoutOn = chargeOn ? addUtcDays(chargeOn, HOLD_DAYS) : null;

    if (!chargeOn || !payoutOn) {
      return null;
    }

    const progress = roundProgress(chargeOn, payoutOn, input.asOf);
    rounds.push({
      number,
      chargeOn,
      payoutOn,
      potMinor,
      days: progress.days,
      interestMinor: interestMinor(potMinor, progress.days),
      state: progress.state,
    });
  }

  const earningMinor = rounds
    .filter((round) => round.state === 'earning')
    .reduce((sum, round) => sum + round.interestMinor, 0);
  const availableMinor = rounds
    .filter((round) => round.state === 'posted')
    .reduce((sum, round) => sum + round.interestMinor, 0);
  const last = rounds[rounds.length - 1] ?? null;
  const splitReady = last !== null && input.asOf >= last.payoutOn;
  const eligible = input.members.filter(
    (member) =>
      member.contributionStatus !== 'failed' &&
      member.contributionStatus !== 'refunded',
  );

  return {
    rounds,
    earningMinor,
    availableMinor,
    splitReady,
    splitOn: last?.payoutOn ?? null,
    shares: splitReady ? splitYield(availableMinor, eligible) : [],
  };
}

export function interestMinor(principalMinor: number, days: number): number {
  if (principalMinor <= 0 || days <= 0) {
    return 0;
  }

  const numerator = principalMinor * 4 * days;

  return Math.floor((numerator + 18250) / 36500);
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function roundProgress(
  chargeOn: string,
  payoutOn: string,
  asOf: string,
): { days: number; state: YieldRoundView['state'] } {
  if (asOf < chargeOn) {
    return { days: 0, state: 'not_started' };
  }

  if (asOf >= payoutOn) {
    return { days: HOLD_DAYS, state: 'posted' };
  }

  return {
    days: utcDayNumber(asOf) - utcDayNumber(chargeOn) + 1,
    state: 'earning',
  };
}

function splitYield(
  availableMinor: number,
  members: YieldMemberInput[],
): YieldShareView[] {
  if (members.length === 0) {
    return [];
  }

  const ordered = [...members].sort(byLatestTurn);
  const base = Math.floor(availableMinor / ordered.length);
  let remainder = availableMinor % ordered.length;
  const shares = new Map<string, number>();

  for (const member of ordered) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    shares.set(member.username, base + extra);
  }

  return [...members].sort(byEarliestTurn).map((member) => ({
    displayName: member.displayName,
    username: member.username,
    payoutPosition: member.payoutPosition,
    amountMinor: shares.get(member.username) ?? 0,
  }));
}

function byLatestTurn(a: YieldMemberInput, b: YieldMemberInput): number {
  return turnRank(b) - turnRank(a) || a.username.localeCompare(b.username);
}

function byEarliestTurn(a: YieldMemberInput, b: YieldMemberInput): number {
  return turnRank(a) - turnRank(b) || a.username.localeCompare(b.username);
}

function turnRank(member: YieldMemberInput): number {
  return member.payoutPosition ?? Number.MAX_SAFE_INTEGER;
}

function addUtcMonths(beginOn: string, months: number): string | null {
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

function addUtcDays(value: string, days: number): string | null {
  const parsed = parseUtcDate(value);

  if (!parsed) {
    return null;
  }

  return new Date(Date.UTC(parsed.year, parsed.month, parsed.day + days))
    .toISOString()
    .slice(0, 10);
}

function utcDayNumber(value: string): number {
  const parsed = parseUtcDate(value);

  if (!parsed) {
    return 0;
  }

  return Date.UTC(parsed.year, parsed.month, parsed.day) / DAY_MS;
}

function utcDate(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function parseUtcDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (
    !match ||
    match[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined
  ) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month: month - 1, day };
}

function isUtcDate(value: string): boolean {
  return parseUtcDate(value) !== null;
}
