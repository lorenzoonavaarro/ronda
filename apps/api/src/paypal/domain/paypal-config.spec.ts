import { describe, expect, it } from '@jest/globals';

import { localhostCallbackRedirect, pageOrigin } from './paypal-config';

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
