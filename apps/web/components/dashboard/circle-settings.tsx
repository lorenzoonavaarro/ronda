'use client';

import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { useAuthedFetch } from '../../lib/authed-fetch';
import { apiBase, readApiError } from '../../lib/http';
import { dollarsToMinor, minorToDollars } from '../../lib/money';

const MIN_SEATS = 2;
const MAX_SEATS = 12;

export function CircleSettings({
  circleId,
  name,
  monthlyAmountMinor,
  memberCount,
  membersRequired,
}: {
  circleId: string;
  name: string;
  monthlyAmountMinor: number;
  memberCount: number;
  membersRequired: number;
}) {
  const router = useRouter();
  const apiFetch = useAuthedFetch();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'save' | 'lock' | null>(null);
  const remaining = membersRequired - memberCount;
  const ready = remaining === 0;
  const minSeats = Math.max(MIN_SEATS, memberCount);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const amount = dollarsToMinor(String(form.get('amount') ?? ''));

    if (amount === null) {
      setError('Enter a monthly amount in dollars, such as 50.00.');
      return;
    }

    const seatsRaw = String(form.get('seats') ?? '').trim();

    if (!/^\d+$/.test(seatsRaw)) {
      setError('Enter a whole number of seats.');
      return;
    }

    const seats = Number(seatsRaw);

    if (seats < MIN_SEATS || seats > MAX_SEATS) {
      setError('A circle has 2 to 12 seats.');
      return;
    }

    if (seats < memberCount) {
      setError('There are already more members than those seats.');
      return;
    }

    setSubmitting('save');

    try {
      const response = await apiFetch(`${apiBase()}/circles/${circleId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          monthlyAmountMinor: amount,
          membersRequired: seats,
        }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      router.refresh();
    } catch {
      setError('The server did not respond. Try again.');
    } finally {
      setSubmitting(null);
    }
  }

  async function lock() {
    setError(null);
    setSubmitting('lock');

    try {
      const response = await apiFetch(`${apiBase()}/circles/${circleId}/lock`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      router.refresh();
    } catch {
      setError('The server did not respond. Try again.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Label className="grid gap-2">
        Circle name
        <Input
          name="name"
          defaultValue={name}
          autoComplete="off"
          required
          maxLength={60}
        />
      </Label>
      <Label className="grid gap-2">
        Monthly amount (USD)
        <Input
          name="amount"
          inputMode="decimal"
          defaultValue={minorToDollars(monthlyAmountMinor)}
          required
        />
      </Label>
      <Label className="grid gap-2">
        Seats
        <Input
          name="seats"
          type="number"
          inputMode="numeric"
          min={minSeats}
          max={MAX_SEATS}
          step={1}
          defaultValue={membersRequired}
          required
        />
      </Label>
      <p className="text-sm text-muted-foreground">
        Charges start on the UTC day every member has approved, then once each
        month.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting !== null}>
          {submitting === 'save' ? 'Please wait' : 'Save settings'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={lock}
          disabled={!ready || submitting !== null}
        >
          {submitting === 'lock'
            ? 'Please wait'
            : 'Lock circle and assign turns'}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {ready
          ? 'Locking gives every member one random turn. The name, monthly amount, seats, and member list stay as they are.'
          : remaining === 1
            ? '1 more member is needed before this circle can lock.'
            : `${remaining} more members are needed before this circle can lock.`}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
