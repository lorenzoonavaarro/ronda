import { describe, expect, it } from '@jest/globals';

import {
  priceFromAlpacaTradeBody,
  pricesFromAlpacaSnapshots,
  quotesFromAlpacaSnapshots,
} from './alpaca-price';

describe('Alpaca prices', () => {
  it('reads the latest trade in cents', () => {
    expect(priceFromAlpacaTradeBody({ trade: { p: 190.1 } })).toBe(19010);
    expect(priceFromAlpacaTradeBody({ trade: { p: 0 } })).toBeNull();
  });

  it('reads snapshot trades by symbol', () => {
    expect(
      pricesFromAlpacaSnapshots({
        AAPL: { latestTrade: { p: 10.5 } },
        MSFT: { latestTrade: { p: -1 } },
      }),
    ).toEqual(new Map([['AAPL', 1050]]));
  });

  it('uses the previous close to describe the daily move', () => {
    expect(
      quotesFromAlpacaSnapshots({
        AAPL: {
          latestTrade: { p: 191.25 },
          prevDailyBar: { c: 190 },
        },
      }).get('AAPL'),
    ).toEqual({ priceMinor: 19125, previousCloseMinor: 19000 });
  });
});
