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
    <>
      <PaperMarket
        quotes={quotes}
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
    </>
  );
}
