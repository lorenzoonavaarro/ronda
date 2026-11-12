import type { PaperAccount, PaperPosition } from '@repo/api';

import { formatUsd } from '../../lib/money';
import { displayPercents, positionSlices } from '../../lib/position-chart';

import { PaperAllocation, sliceOpacity } from './paper-allocation';

export function PaperPortfolio({ account }: { account: PaperAccount }) {
  const holdingsMinor = account.positions.reduce(
    (sum, position) => sum + (position.marketValueMinor ?? 0),
    0,
  );
  const gainMinor = account.positions.reduce(
    (sum, position) => sum + (position.gainMinor ?? 0),
    0,
  );
  const priced = account.positions.every(
    (position) => position.marketValueMinor !== null,
  );
  const knownGain = account.positions.some(
    (position) => position.gainMinor !== null,
  );
  const ranked = [...account.positions].sort(
    (left, right) =>
      (right.marketValueMinor ?? 0) - (left.marketValueMinor ?? 0) ||
      left.symbol.localeCompare(right.symbol),
  );
  const slices = positionSlices(
    ranked.map((position) => ({
      key: position.symbol,
      amount: position.marketValueMinor ?? 0,
    })),
  );
  const percents = displayPercents(slices.map((slice) => slice.fraction));
  const weight = new Map(
    slices.map((slice, index) => [slice.key, percents[index] ?? 0]),
  );

  return (
    <div className="grid gap-10">
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
            {formatUsd(account.cashMinor + holdingsMinor)}
          </p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Paper cash plus the latest value of each position.
            {priced ? '' : ' Positions without a price are left out.'}
          </p>
        </div>
        <Stat label="Paper cash" value={formatUsd(account.cashMinor)} />
        <Stat
          label="Positions"
          value={formatUsd(holdingsMinor)}
          detail={knownGain ? formatSigned(gainMinor) : null}
          detailClass={signedClass(gainMinor)}
        />
      </div>
      <div className="grid items-center gap-8 border-t pt-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <PaperAllocation
          positions={ranked.map((position) => ({
            symbol: position.symbol,
            amountMinor: position.marketValueMinor ?? 0,
          }))}
        />
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No paper positions yet. A buy on the Stock page shows up here.
          </p>
        ) : (
          <ul className="grid gap-5">
            {ranked.map((position, index) => (
              <PositionRow
                key={position.symbol}
                position={position}
                percent={weight.get(position.symbol) ?? 0}
                opacity={sliceOpacity(index)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PositionRow({
  position,
  percent,
  opacity,
}: {
  position: PaperPosition;
  percent: number;
  opacity: number;
}) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <span
        className="size-2 rounded-full bg-foreground"
        style={{ opacity }}
      />
      <div className="min-w-0">
        <p className="font-medium">{position.symbol}</p>
        <p className="text-sm text-muted-foreground">
          {position.quantity} shares
          {percent > 0 ? ` · ${percent}%` : ''}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground"
            style={{ width: `${percent}%`, opacity }}
          />
        </div>
      </div>
      <div className="text-right">
        <p className="tabular-nums">
          {position.marketValueMinor === null
            ? 'Price unavailable'
            : formatUsd(position.marketValueMinor)}
        </p>
        {position.gainMinor === null ? null : (
          <p className={`text-sm tabular-nums ${signedClass(position.gainMinor)}`}>
            {formatSigned(position.gainMinor)}
          </p>
        )}
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  detail,
  detailClass,
}: {
  label: string;
  value: string;
  detail?: string | null;
  detailClass?: string;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {detail ? (
        <p className={`mt-1 text-sm tabular-nums ${detailClass ?? ''}`}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function formatSigned(minor: number): string {
  if (minor > 0) {
    return `+${formatUsd(minor)}`;
  }

  return formatUsd(minor);
}

function signedClass(minor: number): string {
  if (minor > 0) {
    return 'text-emerald-600 dark:text-emerald-400';
  }

  if (minor < 0) {
    return 'text-destructive';
  }

  return 'text-muted-foreground';
}
