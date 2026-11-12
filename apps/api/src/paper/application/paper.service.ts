import { Injectable } from '@nestjs/common';
import type {
  PaperAccount,
  PaperFill,
  PaperMarketQuote,
  PaperQuote,
} from '@repo/api';

import { AlpacaMarketData } from '../infrastructure/alpaca-market-data';
import {
  PgPaperRepository,
  positionQuote,
  type PaperSnapshot,
} from '../infrastructure/pg-paper-repository';
import { PaperOrderError } from '../domain/errors';
import { MARKET_BOARD, marketChange } from '../domain/market-board';
import { formatShares, parsePaperOrder, parseSymbol } from '../domain/paper-order';
import type { PaperGrants } from './ports';

@Injectable()
export class PaperService implements PaperGrants {
  private boardCache: { at: number; quotes: PaperMarketQuote[] } | null = null;
  private hotSymbolsCache: { day: string; symbols: string[] } | null = null;

  constructor(
    private readonly paper: PgPaperRepository,
    private readonly market: AlpacaMarketData,
  ) {}

  async sync(userId: string): Promise<void> {
    await this.paper.sync(userId, new Date());
  }

  async read(userId: string): Promise<PaperAccount> {
    const snapshot = await this.paper.sync(userId, new Date());
    const prices = await this.prices(snapshot.positions.map((item) => item.symbol));

    return this.present(snapshot, prices);
  }

  async marketBoard(): Promise<PaperMarketQuote[]> {
    const cached = this.boardCache;

    if (cached && Date.now() - cached.at < 30_000) {
      return cached.quotes;
    }

    const quotes = await this.loadBoard();

    if (quotes.some((quote) => quote.priceMinor !== null)) {
      this.boardCache = { at: Date.now(), quotes };
    }

    return quotes;
  }

  async quote(symbolValue: string): Promise<PaperQuote> {
    const symbol = parseSymbol(symbolValue);

    if (!symbol) {
      throw new PaperOrderError('Enter a stock symbol such as AAPL.');
    }

    const priceMinor = await this.price(symbol);

    return { symbol, priceMinor };
  }

  async order(userId: string, body: unknown): Promise<PaperFill> {
    const command = parsePaperOrder(body);

    if (!command) {
      throw new PaperOrderError(
        'Enter a symbol and a share quantity such as 1 or 0.25.',
      );
    }

    const priceMinor = await this.price(command.symbol);

    return this.paper.fill(userId, new Date(), { ...command, priceMinor });
  }

  private async loadBoard(): Promise<PaperMarketQuote[]> {
    if (!this.market.configured()) {
      return emptyBoard();
    }

    try {
      const symbols = await this.hotSymbols();
      const quotes = await this.market.boardQuotes(symbols);
      const names = new Map(
        MARKET_BOARD.map((item) => [item.symbol, item.name]),
      );

      return symbols.map((symbol) => {
        const quote = quotes.get(symbol);
        const priceMinor = quote?.priceMinor ?? null;
        const previousCloseMinor = quote?.previousCloseMinor ?? null;

        return {
          symbol,
          name: names.get(symbol) ?? symbol,
          priceMinor,
          previousCloseMinor,
          changeMinor: marketChange(priceMinor, previousCloseMinor),
        };
      });
    } catch {
      return emptyBoard();
    }
  }

  private async hotSymbols(): Promise<string[]> {
    const day = new Date().toISOString().slice(0, 10);
    if (this.hotSymbolsCache?.day === day) {
      return this.hotSymbolsCache.symbols;
    }

    try {
      const symbols = await this.market.hotSymbols();
      const next =
        symbols.length > 0 ? symbols : MARKET_BOARD.map((x) => x.symbol);
      this.hotSymbolsCache = { day, symbols: next };
      return next;
    } catch {
      return MARKET_BOARD.map((item) => item.symbol);
    }
  }

  private async price(symbol: string): Promise<number> {
    if (!this.market.configured()) {
      throw new PaperOrderError('Stock prices are not configured.', 503);
    }

    try {
      const priceMinor = await this.market.latestPrice(symbol);

      if (priceMinor === null) {
        throw new PaperOrderError('No price for that symbol.', 404);
      }

      return priceMinor;
    } catch (error) {
      if (error instanceof PaperOrderError) {
        throw error;
      }

      throw new PaperOrderError('Stock prices are unavailable.', 503);
    }
  }

  private async prices(symbols: string[]): Promise<Map<string, number>> {
    if (!this.market.configured() || symbols.length === 0) {
      return new Map();
    }

    try {
      return await this.market.latestPrices(symbols);
    } catch {
      return new Map();
    }
  }

  private present(
    snapshot: PaperSnapshot,
    prices: Map<string, number>,
  ): PaperAccount {
    return {
      cashMinor: snapshot.cashMinor,
      payoutsReceivedMinor: snapshot.payoutsReceivedMinor,
      obligationsMinor: snapshot.obligationsMinor,
      bufferMinor: snapshot.bufferMinor,
      buysOpen: snapshot.freeze === null,
      freezeReason: snapshot.freeze,
      quotesConfigured: this.market.configured(),
      positions: snapshot.positions.map((position) => {
        const priceMinor = prices.get(position.symbol) ?? null;
        const valued = positionQuote(position, priceMinor);

        return {
          symbol: position.symbol,
          quantity: formatShares(position.quantityE4),
          averageCostMinor: valued.averageCostMinor,
          priceMinor,
          marketValueMinor: valued.marketValueMinor,
          gainMinor: valued.gainMinor,
        };
      }),
      ledger: snapshot.ledger.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        amountMinor: entry.amountMinor,
        description: entry.description,
        createdAt: entry.createdAt.toISOString(),
      })),
      orders: snapshot.orders.map((order) => ({
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: formatShares(order.quantityE4),
        priceMinor: order.priceMinor,
        notionalMinor: order.notionalMinor,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }
}

function emptyBoard(): PaperMarketQuote[] {
  return MARKET_BOARD.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    priceMinor: null,
    previousCloseMinor: null,
    changeMinor: null,
  }));
}
