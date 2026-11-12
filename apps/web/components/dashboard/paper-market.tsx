'use client';

import type { PaperMarketQuote } from '@repo/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { formatUsd } from '../../lib/money';

export function PaperMarket({
  quotes,
  onPick,
  selectedSymbol,
}: {
  quotes: PaperMarketQuote[];
  onPick: (quote: PaperMarketQuote) => void;
  selectedSymbol: string;
}) {
  return (
    <Card className="@container h-full min-w-0">
      <CardHeader>
        <CardTitle>Market</CardTitle>
        <CardDescription>
          A few widely traded stocks and funds. The price is the latest trade.
          Choose one to fill the order.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 grid-cols-2 gap-2 @min-[36rem]:grid-cols-3">
        {quotes.map((quote) => {
          const move = formatMove(quote);
          const selected = quote.symbol === selectedSymbol;

          return (
            <button
              key={quote.symbol}
              type="button"
              className={`min-w-0 rounded-lg border bg-muted p-3 text-left transition-colors hover:border-foreground/60 ${
                selected
                  ? 'border-foreground bg-background'
                  : 'border-foreground/40'
              }`}
              onClick={() => onPick(quote)}
            >
              <span className="block truncate text-xs text-muted-foreground">
                {quote.name}
              </span>
              <span className="mt-1 block font-semibold">{quote.symbol}</span>
              <span className="mt-2 block text-sm">
                {quote.priceMinor === null
                  ? 'Unavailable'
                  : formatUsd(quote.priceMinor)}
              </span>
              <span className="mt-1 block text-xs break-words">
                {move ? (
                  <span
                    className={
                      quote.changeMinor !== null && quote.changeMinor < 0
                        ? 'text-destructive'
                        : quote.changeMinor !== null && quote.changeMinor > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                    }
                  >
                    {move}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function formatMove(quote: PaperMarketQuote): string | null {
  if (
    quote.changeMinor === null ||
    quote.previousCloseMinor === null ||
    quote.previousCloseMinor === 0
  ) {
    return null;
  }

  const percent = (quote.changeMinor / quote.previousCloseMinor) * 100;
  const sign = quote.changeMinor > 0 ? '+' : '';

  return `${sign}${formatUsd(quote.changeMinor)} (${sign}${percent.toFixed(2)}%)`;
}
