import { describe, expect, it } from '@jest/globals';

import {
  fillBuy,
  fillSell,
  formatShares,
  notionalMinor,
  parsePaperOrder,
  parseShareQuantity,
} from './paper-order';

describe('paper orders', () => {
  it('parses a share quantity to four decimal places', () => {
    expect(parseShareQuantity('0.25')).toBe(2500);
    expect(parseShareQuantity('1')).toBe(10000);
    expect(parseShareQuantity('0')).toBeNull();
    expect(parseShareQuantity('1.23456')).toBeNull();
  });

  it('accepts a buy order body', () => {
    expect(
      parsePaperOrder({ symbol: ' aapl ', side: 'buy', quantity: '0.5' }),
    ).toEqual({ symbol: 'AAPL', side: 'buy', quantityE4: 5000 });
    expect(parsePaperOrder({ symbol: 'AAPL', side: 'hold', quantity: '1' })).toBe(
      null,
    );
  });

  it('fills a buy from paper cash and a sell back into paper cash', () => {
    expect(notionalMinor(5000, 19010)).toBe(9505);

    const bought = fillBuy({
      cashMinor: 90000,
      quantityE4: 0,
      costBasisMinor: 0,
      buyQuantityE4: 5000,
      priceMinor: 19010,
    });

    expect(bought).toMatchObject({
      ok: true,
      cashMinor: 80495,
      quantityE4: 5000,
      costBasisMinor: 9505,
    });

    if (!bought.ok) {
      return;
    }

    const sold = fillSell({
      cashMinor: bought.cashMinor,
      quantityE4: bought.quantityE4,
      costBasisMinor: bought.costBasisMinor,
      sellQuantityE4: 5000,
      priceMinor: 20000,
    });

    expect(sold).toMatchObject({
      ok: true,
      cashMinor: 90495,
      quantityE4: 0,
      closed: true,
    });
    expect(formatShares(2500)).toBe('0.25');
    expect(formatShares(10000)).toBe('1');
  });

  it('refuses a buy that costs more than the paper cash', () => {
    expect(
      fillBuy({
        cashMinor: 100,
        quantityE4: 0,
        costBasisMinor: 0,
        buyQuantityE4: 10000,
        priceMinor: 19010,
      }),
    ).toEqual({ ok: false, reason: 'cash' });
  });
});
