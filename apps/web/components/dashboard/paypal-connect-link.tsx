'use client';

import { apiBase } from '@/lib/http';

export function PaypalConnectLink() {
  return (
    <a href={`${apiBase()}/paypal/link`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- PayPal requires this hosted button. */}
      <img
        src="https://www.paypalobjects.com/devdoc/log-in-with-paypal-button.png"
        alt="Log in with PayPal"
        className="h-9 w-auto"
      />
    </a>
  );
}
