const MAX_PRICE_MINOR = 100_000_000;

export function priceMinorFromTrade(price: unknown): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  const minor = Math.round(price * 100);

  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > MAX_PRICE_MINOR) {
    return null;
  }

  return minor;
}

export function priceFromAlpacaTradeBody(body: unknown): number | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const trade = (body as { trade?: { p?: unknown } }).trade;

  return priceMinorFromTrade(trade?.p);
}

export type AlpacaSnapshotQuote = {
  priceMinor: number | null;
  previousCloseMinor: number | null;
};

export function quoteFromAlpacaSnapshot(snapshot: unknown): AlpacaSnapshotQuote {
  if (!snapshot || typeof snapshot !== 'object') {
    return { priceMinor: null, previousCloseMinor: null };
  }

  const record = snapshot as {
    latestTrade?: { p?: unknown };
    dailyBar?: { c?: unknown };
    prevDailyBar?: { c?: unknown };
  };
  const trade = priceMinorFromTrade(record.latestTrade?.p);
  const dailyClose = priceMinorFromTrade(record.dailyBar?.c);

  return {
    priceMinor: trade ?? dailyClose,
    previousCloseMinor: priceMinorFromTrade(record.prevDailyBar?.c),
  };
}

export function quotesFromAlpacaSnapshots(
  body: unknown,
): Map<string, AlpacaSnapshotQuote> {
  const quotes = new Map<string, AlpacaSnapshotQuote>();

  if (!body || typeof body !== 'object') {
    return quotes;
  }

  for (const [symbol, snapshot] of Object.entries(
    body as Record<string, unknown>,
  )) {
    quotes.set(symbol.toUpperCase(), quoteFromAlpacaSnapshot(snapshot));
  }

  return quotes;
}

export function pricesFromAlpacaSnapshots(body: unknown): Map<string, number> {
  const prices = new Map<string, number>();

  for (const [symbol, quote] of quotesFromAlpacaSnapshots(body)) {
    if (quote.priceMinor !== null) {
      prices.set(symbol, quote.priceMinor);
    }
  }

  return prices;
}
