'use client';

import { buttonVariants } from '@repo/ui/components/button';

import { useOpenApi } from '@/lib/authed-fetch';
import { apiBase } from '@/lib/http';

export function ApproveChargesLink({ circleId }: { circleId: string }) {
  const openApi = useOpenApi();

  return (
    <button
      className={buttonVariants()}
      type="button"
      onClick={() =>
        void openApi(`${apiBase()}/paypal/vault/start?circle=${circleId}`)
      }
    >
      Approve charges
    </button>
  );
}
