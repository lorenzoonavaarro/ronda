'use client';

import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { apiBase, readApiError } from '../../lib/http';
import { dollarsToMinor } from '../../lib/money';

export function CreateCircleForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const monthlyAmountMinor = dollarsToMinor(String(form.get('amount') ?? ''));

    if (monthlyAmountMinor === null) {
      setError('Enter a monthly amount in dollars, such as 50.00.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiBase()}/circles`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          monthlyAmountMinor,
        }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('The server did not respond. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid max-w-md gap-4" onSubmit={onSubmit}>
      <Label className="grid gap-2">
        Circle name
        <Input name="name" autoComplete="off" required maxLength={60} />
      </Label>
      <Label className="grid gap-2">
        Monthly amount (USD)
        <Input name="amount" inputMode="decimal" placeholder="50.00" required />
      </Label>
      <p className="text-sm text-muted-foreground">
        You are the first member. The circle stays forming until 6 people have
        joined. Invites come next. The payout order is fixed when it starts, and
        a member who has not paid does not receive that month&apos;s pot.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Please wait' : 'Create circle'}
      </Button>
    </form>
  );
}
