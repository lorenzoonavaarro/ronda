'use client';

import type { PaperMarketQuote } from '@repo/api';
import { useState } from 'react';

import { PaperMarket } from './paper-market';
import { PaperTrade } from './paper-trade';

export function PaperDesk({
  quotes,
  quotesConfigured,
  buysOpen,
}: {
  quotes: PaperMarketQuote[];
  quotesConfigured: boolean;
  buysOpen: boolean;
}) {
  const [symbol, setSymbol] = useState('');
  const [picked, setPicked] = useState<PaperMarketQuote | null>(null);

  return (
    <div className="grid items-center gap-4 @3xl/main:grid-cols-[minmax(0,1.65fr)_minmax(16rem,22rem)]">
      <PaperMarket
        quotes={quotes}
        selectedSymbol={symbol.trim().toUpperCase()}
        onPick={(quote) => {
          setSymbol(quote.symbol);
          setPicked(quote);
        }}
      />
      <PaperTrade
        quotesConfigured={quotesConfigured}
        buysOpen={buysOpen}
        symbol={symbol}
        onSymbolChange={setSymbol}
        picked={picked}
      />
    </div>
  );
}
