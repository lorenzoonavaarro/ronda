'use client';

import { Button } from '@repo/ui/components/button';
import { DropdownMenuItem } from '@repo/ui/components/dropdown-menu';
import { LogOutIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiBase } from '../lib/http';

export function LogoutButton({ menu = false }: { menu?: boolean }) {
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

  if (menu) {
    return (
      <DropdownMenuItem onClick={logout} disabled={submitting}>
        <LogOutIcon />
        Log out
      </DropdownMenuItem>
    );
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
