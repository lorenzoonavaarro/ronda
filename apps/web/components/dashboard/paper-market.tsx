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
}: {
  quotes: PaperMarketQuote[];
  onPick: (quote: PaperMarketQuote) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Market</CardTitle>
        <CardDescription>
          A few widely traded stocks and funds. The price is the latest trade.
          Choose one to fill the order below.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1">
        {quotes.map((quote) => {
          const move = formatMove(quote);

          return (
            <button
              key={quote.symbol}
              type="button"
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onPick(quote)}
            >
              <span>
                <span className="font-medium">{quote.symbol}</span>
                <span className="ml-2 text-muted-foreground">{quote.name}</span>
              </span>
              <span className="text-right">
                <span className="block">
                  {quote.priceMinor === null
                    ? 'Price unavailable'
                    : formatUsd(quote.priceMinor)}
                </span>
                {move ? (
                  <span
                    className={
                      quote.changeMinor !== null && quote.changeMinor < 0
                        ? 'text-destructive'
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
