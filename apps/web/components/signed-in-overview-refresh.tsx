'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export const OVERVIEW_REFRESH_KEY = 'ronda-overview-refresh';

export function clearOverviewRefresh(): void {
  sessionStorage.removeItem(OVERVIEW_REFRESH_KEY);
}

export function SignedInOverviewRefresh() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      clearOverviewRefresh();
      return;
    }

    if (sessionStorage.getItem(OVERVIEW_REFRESH_KEY) === '1') {
      return;
    }

    sessionStorage.setItem(OVERVIEW_REFRESH_KEY, '1');
    router.refresh();
  }, [isLoaded, isSignedIn, router]);

  return null;
}
