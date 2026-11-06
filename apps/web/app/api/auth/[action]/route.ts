import { NextResponse } from 'next/server';

import { apiBase } from '@/lib/http';
import { safeNextPath } from '@/lib/next-path';

const actions = new Set(['login', 'register', 'logout']);

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;

  if (!actions.has(action)) {
    return NextResponse.json({ message: 'Not found.' }, { status: 404 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  const formPost =
    action !== 'logout' &&
    (contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data'));

  let nextPath: string | null = null;
  let body: string | undefined;

  if (action !== 'logout') {
    if (formPost) {
      if (!originAllowed(request)) {
        return seeOther(
          failurePath(action, null, 'Sign-in could not be completed.'),
        );
      }

      const form = await request.formData();
      nextPath = safeNextPath(field(form.get('next')) || undefined);
      body = JSON.stringify({
        username: field(form.get('username')),
        password: field(form.get('password')),
        ...(action === 'register'
          ? {
              displayName: field(form.get('displayName')),
              email: field(form.get('email')),
            }
          : {}),
      });
    } else {
      body = await request.text();
    }
  }

  const headers = new Headers();
  const cookie = request.headers.get('cookie');

  if (cookie) {
    headers.set('cookie', cookie);
  }

  if (action !== 'logout') {
    headers.set('content-type', 'application/json');
  }

  let upstream: Response;

  try {
    upstream = await fetch(`${apiBase()}/auth/${action}`, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    });
  } catch {
    if (formPost) {
      return seeOther(
        failurePath(action, nextPath, 'The server did not respond. Try again.'),
      );
    }

    return NextResponse.json(
      { message: 'The server did not respond. Try again.' },
      { status: 502 },
    );
  }

  const payload = await upstream.arrayBuffer();

  if (formPost) {
    if (!upstream.ok) {
      return seeOther(failurePath(action, nextPath, messageFrom(payload)));
    }

    return seeOther(nextPath ?? '/', upstream.headers.getSetCookie());
  }

  const response = new NextResponse(payload, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    },
  });

  for (const setCookie of upstream.headers.getSetCookie()) {
    response.headers.append('set-cookie', setCookie);
  }

  return response;
}

function field(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');

  if (!origin) {
    return true;
  }

  const host = request.headers.get('host');

  if (!host) {
    return false;
  }

  return origin === `http://${host}` || origin === `https://${host}`;
}

function messageFrom(payload: ArrayBuffer): string {
  try {
    const body = JSON.parse(new TextDecoder().decode(payload)) as {
      message?: unknown;
    };
    const message = Array.isArray(body.message)
      ? body.message.filter((item) => typeof item === 'string').join(' ')
      : body.message;

    if (typeof message === 'string') {
      const cleaned = message.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();

      if (cleaned && cleaned.length <= 200) {
        return cleaned;
      }
    }
  } catch {
    return 'Something went wrong. Try again.';
  }

  return 'Something went wrong. Try again.';
}

function failurePath(
  action: string,
  nextPath: string | null,
  message: string,
): string {
  const params = new URLSearchParams({ error: message });

  if (nextPath) {
    params.set('next', nextPath);
  }

  const page = action === 'register' ? '/register' : '/login';

  return `${page}?${params.toString()}`;
}

function seeOther(location: string, cookies: string[] = []): NextResponse {
  const headers = new Headers({ location });

  for (const cookie of cookies) {
    headers.append('set-cookie', cookie);
  }

  return new NextResponse(null, { status: 303, headers });
}
