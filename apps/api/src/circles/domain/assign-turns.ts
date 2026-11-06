import { randomInt } from 'node:crypto';

export function shuffled<T>(
  items: readonly T[],
  random: (exclusiveMax: number) => number = (exclusiveMax) =>
    randomInt(exclusiveMax),
): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = random(index + 1);
    const current = copy[index];
    const swap = copy[swapIndex];

    if (
      current === undefined ||
      swap === undefined ||
      swapIndex < 0 ||
      swapIndex > index
    ) {
      throw new Error('Shuffle index was outside the list.');
    }

    copy[index] = swap;
    copy[swapIndex] = current;
  }

  return copy;
}

export function sameMembers(
  source: readonly string[],
  ordered: readonly string[],
): boolean {
  if (source.length !== ordered.length) {
    return false;
  }

  const counts = new Map<string, number>();

  for (const id of source) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  for (const id of ordered) {
    const count = counts.get(id);

    if (!count) {
      return false;
    }

    counts.set(id, count - 1);
  }

  return true;
}
