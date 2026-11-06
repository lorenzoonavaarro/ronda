'use client';

import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { useEffect, useRef, useState } from 'react';

export function InviteLink({ token }: { token: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const path = `/join/${token}`;

  useEffect(() => {
    const node = inputRef.current;

    if (node) {
      node.value = `${window.location.origin}${path}`;
    }
  }, [path]);

  async function copy() {
    const link = inputRef.current?.value || path;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Input
        ref={inputRef}
        readOnly
        defaultValue={path}
        aria-label="Invite link"
      />
      <Button type="button" variant="outline" onClick={copy}>
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    </div>
  );
}
