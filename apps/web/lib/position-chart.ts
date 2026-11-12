export type PositionSlice = {
  key: string;
  amount: number;
  fraction: number;
  start: number;
};

export function positionSlices(
  items: { key: string; amount: number }[],
): PositionSlice[] {
  const usable = items.filter((item) => item.amount > 0);
  const total = usable.reduce((sum, item) => sum + item.amount, 0);

  if (total <= 0) {
    return [];
  }

  let start = 0;

  return usable.map((item) => {
    const fraction = item.amount / total;
    const slice = {
      key: item.key,
      amount: item.amount,
      fraction,
      start,
    };

    start += fraction;

    return slice;
  });
}

export function displayPercents(fractions: number[]): number[] {
  if (fractions.length === 0) {
    return [];
  }

  const floors = fractions.map((fraction) => Math.floor(fraction * 100));
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = fractions
    .map((fraction, index) => ({
      index,
      extra: fraction * 100 - Math.floor(fraction * 100),
    }))
    .sort((left, right) => right.extra - left.extra || left.index - right.index);

  const percents = [...floors];

  for (const item of order) {
    if (remainder <= 0) {
      break;
    }

    const current = percents[item.index];

    if (current === undefined) {
      continue;
    }

    percents[item.index] = current + 1;
    remainder -= 1;
  }

  return percents;
}
