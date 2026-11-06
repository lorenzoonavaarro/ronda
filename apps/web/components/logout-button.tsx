'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@repo/ui/components/button';

import { apiBase } from '../lib/http';

export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function logout() {
    setSubmitting(true);

    try {
      await fetch(`${apiBase()}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={logout}
      disabled={submitting}
    >
      Log out
    </Button>
  );
}
