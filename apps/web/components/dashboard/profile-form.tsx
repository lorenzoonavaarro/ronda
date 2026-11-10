'use client';

import type { AuthUser } from '@repo/api';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { useAuthedFetch } from '../../lib/authed-fetch';
import { apiBase, readApiError } from '../../lib/http';

export function ProfileForm({ user }: { user: AuthUser }) {
  const apiFetch = useAuthedFetch();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);

    try {
      const response = await apiFetch(`${apiBase()}/auth/me`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName, username }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const updated = (await response.json()) as AuthUser;
      setDisplayName(updated.displayName);
      setUsername(updated.username);
      setMessage('Profile updated.');
    } catch {
      setError('The server did not respond. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label className="grid gap-2">
          Display name
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
            required
          />
        </Label>
        <Label className="grid gap-2">
          Username
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={30}
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Label>
      </div>
      <Label className="grid gap-2">
        Email
        <Input value={user.email} type="email" readOnly disabled />
      </Label>
      <p className="text-xs text-muted-foreground">
        Email and password changes are managed by your sign-in provider.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <Button type="submit" className="w-fit" disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
