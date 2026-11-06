'use client';

import { Button } from '@repo/ui/components/button';
import { DropdownMenuItem } from '@repo/ui/components/dropdown-menu';
import { LogOutIcon } from 'lucide-react';
import { useState } from 'react';

export function LogoutButton({ menu = false }: { menu?: boolean }) {
  const [submitting, setSubmitting] = useState(false);

  async function logout() {
    setSubmitting(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      window.location.replace('/');
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
