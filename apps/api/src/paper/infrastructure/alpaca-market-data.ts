import { Injectable } from '@nestjs/common';

import {
  priceFromAlpacaTradeBody,
  quotesFromAlpacaSnapshots,
  pricesFromAlpacaSnapshots,
  type AlpacaSnapshotQuote,
} from '../domain/alpaca-price';

const DATA_URL = 'https://data.alpaca.markets';

@Injectable()
export class AlpacaMarketData {
  configured(): boolean {
    return credentials() !== null;
  }

  async latestPrice(symbol: string): Promise<number | null> {
    const keys = credentials();

    if (!keys) {
      return null;
    }

    const response = await fetch(
      `${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`,
      { headers: headers(keys), signal: AbortSignal.timeout(8000) },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Alpaca price request failed with status ${response.status}`);
    }

    return priceFromAlpacaTradeBody(await response.json());
  }

  async latestPrices(symbols: string[]): Promise<Map<string, number>> {
    const keys = credentials();

    if (!keys || symbols.length === 0) {
      return new Map();
    }

    const response = await fetch(
      `${DATA_URL}/v2/stocks/snapshots?symbols=${symbols
        .map((symbol) => encodeURIComponent(symbol))
        .join(',')}&feed=iex`,
      { headers: headers(keys), signal: AbortSignal.timeout(8000) },
    );

    if (!response.ok) {
      throw new Error(
        `Alpaca snapshot request failed with status ${response.status}`,
      );
    }

    return pricesFromAlpacaSnapshots(await response.json());
  }

  async boardQuotes(symbols: string[]): Promise<Map<string, AlpacaSnapshotQuote>> {
    const keys = credentials();

    if (!keys || symbols.length === 0) {
      return new Map();
    }

    const response = await fetch(
      `${DATA_URL}/v2/stocks/snapshots?symbols=${symbols
        .map((symbol) => encodeURIComponent(symbol))
        .join(',')}&feed=iex`,
      { headers: headers(keys), signal: AbortSignal.timeout(8000) },
    );

    if (!response.ok) {
      throw new Error(
        `Alpaca snapshot request failed with status ${response.status}`,
      );
    }

    return quotesFromAlpacaSnapshots(await response.json());
  }

  async hotSymbols(limit = 6): Promise<string[]> {
    const keys = credentials();

    if (!keys) {
      return [];
    }

    const response = await fetch(
      `${DATA_URL}/v1beta1/screener/stocks/movers?top=${limit}`,
      { headers: headers(keys), signal: AbortSignal.timeout(8000) },
    );

    if (!response.ok) {
      throw new Error(
        `Alpaca movers request failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      gainers?: unknown;
      losers?: unknown;
    };
    const symbols: string[] = [];

    for (const group of [payload.gainers, payload.losers]) {
      if (!Array.isArray(group)) {
        continue;
      }

      for (const item of group) {
        if (
          item &&
          typeof item === 'object' &&
          'symbol' in item &&
          typeof item.symbol === 'string' &&
          /^[A-Z]{1,5}(?:\.[A-Z]{1,2})?$/.test(item.symbol)
        ) {
          const symbol = item.symbol.toUpperCase();
          if (!symbols.includes(symbol)) {
            symbols.push(symbol);
          }
        }
      }
    }

    return symbols.slice(0, limit * 2);
  }
}

function credentials(): { key: string; secret: string } | null {
  const key =
    process.env.ALPACA_API_KEY_ID?.trim() ||
    process.env.APCA_API_KEY_ID?.trim() ||
    '';
  const secret =
    process.env.ALPACA_API_SECRET_KEY?.trim() ||
    process.env.APCA_API_SECRET_KEY?.trim() ||
    '';

  if (!key || !secret) {
    return null;
  }

  return { key, secret };
}

function headers(keys: { key: string; secret: string }): Headers {
  return new Headers({
    'APCA-API-KEY-ID': keys.key,
    'APCA-API-SECRET-KEY': keys.secret,
  });
}
