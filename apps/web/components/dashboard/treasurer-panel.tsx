'use client';

import type { TreasurerReply } from '@repo/api';
import { Button } from '@repo/ui/components/button';
import { useState, type FormEvent } from 'react';

import { apiBase, readApiError } from '../../lib/http';

const prompts = [
  'Who still needs to approve charges?',
  'Explain my score in this circle.',
  'Is this round ready to pay out?',
];

export function TreasurerPanel({ circleId }: { circleId: string }) {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();

    if (!trimmed) {
      setError('Enter a question.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${apiBase()}/treasurer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: trimmed, circleId }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const body = (await response.json()) as TreasurerReply;
      setReply(body.reply);
      setMessage('');
    } catch {
      setError('The server did not respond. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(message);
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => {
              setMessage(prompt);
              void ask(prompt);
            }}
          >
            {prompt}
          </Button>
        ))}
      </div>
      <textarea
        name="message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Ask about charges, the score, or this round's payout."
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Asking…' : 'Ask the treasurer'}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {reply ? <p className="text-sm whitespace-pre-wrap">{reply}</p> : null}
    </form>
  );
}
