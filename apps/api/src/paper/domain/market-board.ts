export const MARKET_BOARD = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'JPM', name: 'JPMorgan' },
  { symbol: 'DIS', name: 'Disney' },
  { symbol: 'KO', name: 'Coca-Cola' },
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'Nasdaq 100' },
] as const;

export function marketChange(
  priceMinor: number | null,
  previousCloseMinor: number | null,
): number | null {
  if (priceMinor === null || previousCloseMinor === null) {
    return null;
  }

  return priceMinor - previousCloseMinor;
}
