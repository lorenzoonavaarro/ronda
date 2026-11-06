'use client';

import { Button } from '@repo/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiBase, readApiError } from '../../lib/http';

export function JoinCircle({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function join() {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${apiBase()}/circles/join`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const circle = (await response.json()) as { id: string };
      router.push(`/circles/${circle.id}`);
      router.refresh();
    } catch {
      setError('The server did not respond. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Button type="button" onClick={join} disabled={submitting}>
        {submitting ? 'Joining…' : 'Join circle'}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
