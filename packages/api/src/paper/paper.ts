export type PaperFreezeReason =
  | 'missed_contribution'
  | 'reserve_short'
  | 'payout_reversed';

export type PaperPosition = {
  symbol: string;
  quantity: string;
  averageCostMinor: number;
  priceMinor: number | null;
  marketValueMinor: number | null;
  gainMinor: number | null;
};

export type PaperOrderRecord = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  priceMinor: number;
  notionalMinor: number;
  createdAt: string;
};

export type PaperCashLedgerEntry = {
  id: string;
  kind: 'payout' | 'payout_reversal' | 'buy' | 'sell';
  amountMinor: number;
  description: string;
  createdAt: string;
};

export type PaperAccount = {
  cashMinor: number;
  payoutsReceivedMinor: number;
  obligationsMinor: number;
  bufferMinor: number;
  buysOpen: boolean;
  freezeReason: PaperFreezeReason | null;
  quotesConfigured: boolean;
  positions: PaperPosition[];
  orders: PaperOrderRecord[];
  ledger: PaperCashLedgerEntry[];
};

export type PaperQuote = {
  symbol: string;
  priceMinor: number;
};

export type PaperMarketQuote = {
  symbol: string;
  name: string;
  priceMinor: number | null;
  previousCloseMinor: number | null;
  changeMinor: number | null;
};

export type PaperFill = {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  priceMinor: number;
  notionalMinor: number;
};
