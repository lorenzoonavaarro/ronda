'use client';

import { useState } from 'react';

import { Button } from '@repo/ui/components/button';

import { useAuthedFetch } from '../../lib/authed-fetch';
import { apiBase, readApiError } from '../../lib/http';

export function ConfirmPayoutButton({ circleId }: { circleId: string }) {
  const apiFetch = useAuthedFetch();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await apiFetch(
        `${apiBase()}/payouts/${circleId}/confirm`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );

      if (!response.ok) {
        setMessage(await readApiError(response));
        return;
      }

      const payout = (await response.json()) as {
        status?: string;
        amountMinor?: number;
      };
      setMessage(
        payout.status === 'submitted'
          ? 'Payout submitted to PayPal.'
          : `Payout status: ${payout.status ?? 'pending'}.`,
      );
    } catch {
      setMessage('The payout service did not respond. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        onClick={() => void confirm()}
        disabled={submitting}
      >
        {submitting ? 'Sending payout…' : 'Confirm and send payout'}
      </Button>
      <p className="text-xs text-muted-foreground">
        This sends the current round&apos;s collected pot to its recipient.
      </p>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
