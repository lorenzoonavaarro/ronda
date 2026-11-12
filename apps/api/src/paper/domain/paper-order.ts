export function parseSymbol(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const symbol = value.trim().toUpperCase();

  if (!/^[A-Z]{1,5}(?:\.[A-Z]{1,2})?$/.test(symbol)) {
    return null;
  }

  return symbol;
}

export function parseShareQuantity(value: unknown): number | null {
  const text =
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';

  if (!/^\d+(\.\d{1,4})?$/.test(text)) {
    return null;
  }

  const [whole, fraction = ''] = text.split('.');

  if (whole === undefined) {
    return null;
  }

  const quantityE4 =
    Number(whole) * 10000 + Number(fraction.padEnd(4, '0').slice(0, 4));

  if (
    !Number.isSafeInteger(quantityE4) ||
    quantityE4 <= 0 ||
    quantityE4 > 100_000 * 10000
  ) {
    return null;
  }

  return quantityE4;
}

export function parsePaperOrder(
  body: unknown,
): { symbol: string; side: 'buy' | 'sell'; quantityE4: number } | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const symbol = parseSymbol(record.symbol);
  const quantityE4 = parseShareQuantity(record.quantity);

  if (!symbol || quantityE4 === null) {
    return null;
  }

  if (record.side !== 'buy' && record.side !== 'sell') {
    return null;
  }

  return { symbol, side: record.side, quantityE4 };
}

export function formatShares(quantityE4: number): string {
  const whole = Math.trunc(quantityE4 / 10000);
  const fraction = String(Math.abs(quantityE4 % 10000))
    .padStart(4, '0')
    .replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function notionalMinor(quantityE4: number, priceMinor: number): number {
  return Math.round((quantityE4 * priceMinor) / 10000);
}

export function averageCostMinor(
  quantityE4: number,
  costBasisMinor: number,
): number {
  if (quantityE4 <= 0) {
    return 0;
  }

  return Math.round((costBasisMinor * 10000) / quantityE4);
}

export type FillOk = {
  ok: true;
  cashMinor: number;
  quantityE4: number;
  costBasisMinor: number;
  notionalMinor: number;
  closed: boolean;
};

export type FillNo = { ok: false; reason: 'cash' | 'shares' | 'notional' };

export function fillBuy(input: {
  cashMinor: number;
  quantityE4: number;
  costBasisMinor: number;
  buyQuantityE4: number;
  priceMinor: number;
}): FillOk | FillNo {
  const cost = notionalMinor(input.buyQuantityE4, input.priceMinor);

  if (cost < 1) {
    return { ok: false, reason: 'notional' };
  }

  if (cost > input.cashMinor) {
    return { ok: false, reason: 'cash' };
  }

  return {
    ok: true,
    cashMinor: input.cashMinor - cost,
    quantityE4: input.quantityE4 + input.buyQuantityE4,
    costBasisMinor: input.costBasisMinor + cost,
    notionalMinor: cost,
    closed: false,
  };
}

export function fillSell(input: {
  cashMinor: number;
  quantityE4: number;
  costBasisMinor: number;
  sellQuantityE4: number;
  priceMinor: number;
}): FillOk | FillNo {
  if (input.sellQuantityE4 > input.quantityE4) {
    return { ok: false, reason: 'shares' };
  }

  const proceeds = notionalMinor(input.sellQuantityE4, input.priceMinor);

  if (proceeds < 1) {
    return { ok: false, reason: 'notional' };
  }

  const soldBasis = Math.min(
    input.costBasisMinor,
    Math.round(
      (input.costBasisMinor * input.sellQuantityE4) / input.quantityE4,
    ),
  );
  const quantityE4 = input.quantityE4 - input.sellQuantityE4;

  return {
    ok: true,
    cashMinor: input.cashMinor + proceeds,
    quantityE4,
    costBasisMinor: input.costBasisMinor - soldBasis,
    notionalMinor: proceeds,
    closed: quantityE4 === 0,
  };
}
