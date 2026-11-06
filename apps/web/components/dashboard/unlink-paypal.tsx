'use client';

import { Button } from '@repo/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiBase, readApiError } from '../../lib/http';

export function UnlinkPaypal() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function unlink() {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${apiBase()}/paypal/unlink`, {
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
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={unlink}
        disabled={submitting}
      >
        Remove PayPal account
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
