'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const REFRESH_KEY = 'ronda-overview-refresh';

export function SignedInOverviewRefresh() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      sessionStorage.removeItem(REFRESH_KEY);
      return;
    }

    if (sessionStorage.getItem(REFRESH_KEY) === '1') {
      return;
    }

    sessionStorage.setItem(REFRESH_KEY, '1');
    router.refresh();
  }, [isLoaded, isSignedIn, router]);

  return null;
}
