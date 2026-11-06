'use client';

import { buttonVariants } from '@repo/ui/components/button';
import { useEffect, useState } from 'react';

import { apiBase } from '@/lib/http';

export function ApproveChargesLink({ circleId }: { circleId: string }) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    setHref(`${apiBase()}/paypal/vault/start?circle=${circleId}`);
  }, [circleId]);

  if (!href) {
    return <span className={buttonVariants()}>Approve charges</span>;
  }

  return (
    <a className={buttonVariants()} href={href}>
      Approve charges
    </a>
  );
}
