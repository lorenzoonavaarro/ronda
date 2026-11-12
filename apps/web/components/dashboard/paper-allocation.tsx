import { formatUsd } from '../../lib/money';
import { displayPercents, positionSlices } from '../../lib/position-chart';

const radius = 62;
const center = 80;
const circumference = 2 * Math.PI * radius;

export function PaperAllocation({
  positions,
}: {
  positions: {
    symbol: string;
    amountMinor: number;
  }[];
}) {
  const slices = positionSlices(
    positions.map((position) => ({
      key: position.symbol,
      amount: position.amountMinor,
    })),
  );
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  const percents = displayPercents(slices.map((slice) => slice.fraction));
  const label =
    slices.length === 0
      ? 'No priced positions.'
      : `Positions by value. ${slices
          .map((slice, index) => `${slice.key} ${percents[index] ?? 0} percent`)
          .join(', ')}.`;

  return (
    <svg
      viewBox="0 0 160 160"
      role="img"
      aria-label={label}
      className="mx-auto size-52"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth="14"
        className="stroke-border"
      />
      <g transform={`rotate(-90 ${center} ${center})`}>
        {slices.map((slice, index) => {
          const gap = slices.length > 1 ? 3 : 0;
          const length = Math.max(slice.fraction * circumference - gap, 1);

          return (
            <circle
              key={slice.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth="14"
              strokeLinecap="butt"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-slice.start * circumference}
              className="stroke-foreground"
              strokeOpacity={sliceOpacity(index)}
            />
          );
        })}
      </g>
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        className="fill-foreground text-[13px] font-semibold"
      >
        {slices.length === 0 ? 'None' : formatUsd(total)}
      </text>
      <text
        x={center}
        y={center + 14}
        textAnchor="middle"
        className="fill-muted-foreground text-[10px]"
      >
        {slices.length === 0 ? 'No positions' : 'Positions'}
      </text>
    </svg>
  );
}

export function sliceOpacity(index: number): number {
  const steps = [0.92, 0.62, 0.38, 0.22];

  return steps[index % steps.length] ?? 0.22;
}
