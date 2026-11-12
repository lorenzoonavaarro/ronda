export type ChartBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type ChartPoint = {
  x: number;
  y: number;
};

export function scoreLine(
  series: { points: number }[],
  box: ChartBox,
): { points: ChartPoint[]; zeroY: number | null } {
  if (series.length === 0) {
    return { points: [], zeroY: null };
  }

  const values = series.map((item) => item.points);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const yOf = (value: number) =>
    box.bottom - ((value - min) / span) * (box.bottom - box.top);
  const points = series.map((item, index) => ({
    x:
      series.length === 1
        ? (box.left + box.right) / 2
        : box.left +
          (index * (box.right - box.left)) / (series.length - 1),
    y: yOf(item.points),
  }));

  return {
    points,
    zeroY: min < 0 && max > 0 ? yOf(0) : null,
  };
}

export function barFraction(value: number, max: number): number {
  if (max <= 0 || value <= 0) {
    return 0;
  }

  return value / max;
}
