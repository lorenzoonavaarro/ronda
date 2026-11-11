import { describe, expect, it } from '@jest/globals';

import {
  localhostCallbackRedirect,
  pageOrigin,
  paypalReturnUrl,
  vaultReturnUrl,
} from './paypal-config';

describe('pageOrigin', () => {
  it('sends a loopback browser to localhost', () => {
    expect(pageOrigin('127.0.0.1', 'http://127.0.0.1:3001')).toBe(
      'http://localhost:3001',
    );
    expect(pageOrigin('localhost', 'http://127.0.0.1:3001')).toBe(
      'http://localhost:3001',
    );
  });

  it('keeps a public origin', () => {
    expect(pageOrigin('ronda.example', 'https://ronda.example')).toBe(
      'https://ronda.example',
    );
  });
});

describe('paypal return urls', () => {
  it('keeps the local callback unless a public Render origin is set', () => {
    expect(paypalReturnUrl({})).toBe('http://127.0.0.1:3000/paypal/callback');
    expect(vaultReturnUrl({ PORT: '3000' })).toBe(
      'http://127.0.0.1:3000/paypal/vault/callback',
    );
    expect(
      paypalReturnUrl({
        RENDER_EXTERNAL_URL: 'https://ronda-bl3s.onrender.com/',
      }),
    ).toBe('https://ronda-bl3s.onrender.com/paypal/callback');
    expect(
      vaultReturnUrl({
        RENDER_EXTERNAL_URL: 'https://ronda-bl3s.onrender.com',
      }),
    ).toBe('https://ronda-bl3s.onrender.com/paypal/vault/callback');
  });

  it('lets an explicit return url win', () => {
    expect(
      paypalReturnUrl({
        PAYPAL_RETURN_URL: 'https://example.test/paypal/callback',
        RENDER_EXTERNAL_URL: 'https://ronda-bl3s.onrender.com',
      }),
    ).toBe('https://example.test/paypal/callback');
  });
});

describe('localhostCallbackRedirect', () => {
  it('continues a 127.0.0.1 PayPal return on localhost', () => {
    expect(
      localhostCallbackRedirect('127.0.0.1', '3000', {
        code: 'abc',
        state: 'def',
      }),
    ).toBe('http://localhost:3000/paypal/callback?code=abc&state=def');
  });

  it('leaves a localhost return in place', () => {
    expect(
      localhostCallbackRedirect('localhost', '3000', { code: 'abc' }),
    ).toBeNull();
  });
});
