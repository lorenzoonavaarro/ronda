'use client';

import type { PaperFill, PaperMarketQuote, PaperQuote } from '@repo/api';
import { Button } from '@repo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

import { useAuthedFetch } from '../../lib/authed-fetch';
import { apiBase, readApiError } from '../../lib/http';
import { formatUsd } from '../../lib/money';

export function PaperTrade({
  quotesConfigured,
  buysOpen,
  symbol,
  onSymbolChange,
  picked,
}: {
  quotesConfigured: boolean;
  buysOpen: boolean;
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  picked: PaperMarketQuote | null;
}) {
  const router = useRouter();
  const apiFetch = useAuthedFetch();
  const [quote, setQuote] = useState<PaperQuote | null>(null);
  const [fill, setFill] = useState<PaperFill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'quote' | 'buy' | 'sell' | null>(null);
  const actionRef = useRef<'quote' | 'buy' | 'sell'>('quote');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = actionRef.current;
    const quantity = String(form.get('quantity') ?? '');

    setError(null);
    setFill(null);

    if ((action === 'buy' || action === 'sell') && quantity.trim() === '') {
      setError('Enter a share quantity such as 1 or 0.25.');
      return;
    }

    if (action === 'quote') {
      setPending('quote');

      try {
        const response = await apiFetch(
          `${apiBase()}/paper/quotes/${encodeURIComponent(symbol.trim())}`,
        );

        if (!response.ok) {
          setQuote(null);
          setError(await readApiError(response));
          return;
        }

        setQuote((await response.json()) as PaperQuote);
      } catch {
        setError('The server did not respond. Try again.');
      } finally {
        setPending(null);
      }

      return;
    }

    if (action !== 'buy' && action !== 'sell') {
      return;
    }

    setPending(action);

    try {
      const response = await apiFetch(`${apiBase()}/paper/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol, side: action, quantity }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const next = (await response.json()) as PaperFill;
      setFill(next);
      setQuote({ symbol: next.symbol, priceMinor: next.priceMinor });
      router.refresh();
    } catch {
      setError('The server did not respond. Try again.');
    } finally {
      setPending(null);
    }
  }

  const pickedQuote =
    picked &&
    picked.symbol === symbol.trim().toUpperCase() &&
    picked.priceMinor !== null
      ? { symbol: picked.symbol, priceMinor: picked.priceMinor }
      : null;
  const shown = pickedQuote ?? quote;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Trade</CardTitle>
        <CardDescription>
          Buys use paper cash. Sells put paper cash back. Neither one moves
          the PayPal payout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <Label className="grid gap-2">
            Symbol
            <Input
              name="symbol"
              value={symbol}
              onChange={(event) => onSymbolChange(event.target.value)}
              autoComplete="off"
              placeholder="AAPL"
              required
              maxLength={8}
            />
          </Label>
          <Label className="grid gap-2">
            Shares
            <Input
              name="quantity"
              inputMode="decimal"
              placeholder="0.25"
            />
          </Label>
          {shown ? (
            <p className="text-sm">
              {shown.symbol} last traded at {formatUsd(shown.priceMinor)}.
            </p>
          ) : null}
          {fill ? (
            <p className="text-sm">
              {fill.side === 'buy' ? 'Bought' : 'Sold'} {fill.quantity}{' '}
              {fill.symbol} for {formatUsd(fill.notionalMinor)}.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="outline"
              disabled={!quotesConfigured || pending !== null}
              onClick={() => {
                actionRef.current = 'quote';
              }}
            >
              {pending === 'quote' ? 'Checking' : 'Check price'}
            </Button>
            <Button
              type="submit"
              disabled={!quotesConfigured || !buysOpen || pending !== null}
              onClick={() => {
                actionRef.current = 'buy';
              }}
            >
              {pending === 'buy' ? 'Buying' : 'Buy'}
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={!quotesConfigured || pending !== null}
              onClick={() => {
                actionRef.current = 'sell';
              }}
            >
              {pending === 'sell' ? 'Selling' : 'Sell'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
