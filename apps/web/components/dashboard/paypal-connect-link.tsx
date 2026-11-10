'use client';

import { apiBase } from '@/lib/http';
import { useOpenApi } from '@/lib/authed-fetch';

export function PaypalConnectLink() {
  const openApi = useOpenApi();

  return (
    <button
      type="button"
      onClick={() => void openApi(`${apiBase()}/paypal/link`)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- PayPal requires this hosted button. */}
      <img
        src="https://www.paypalobjects.com/devdoc/log-in-with-paypal-button.png"
        alt="Log in with PayPal"
        className="h-9 w-auto"
      />
    </button>
  );
}
