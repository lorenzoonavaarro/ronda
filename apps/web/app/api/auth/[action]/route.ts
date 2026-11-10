import { NextResponse } from 'next/server';

import { apiBase } from '@/lib/http';
import { safeNextPath } from '@/lib/next-path';

const actions = new Set(['login', 'register', 'logout']);
const ACCESS_COOKIE = 'ronda_access_token';
const REFRESH_COOKIE = 'ronda_refresh_token';

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
  let body:
    | {
        username?: string;
        email?: string;
        password: string;
        data?: Record<string, string>;
      }
    | undefined;

  if (action !== 'logout') {
    if (formPost) {
      if (!originAllowed(request)) {
        return seeOther(
          failurePath(action, null, 'Sign-in could not be completed.'),
        );
      }

      const form = await request.formData();
      nextPath = safeNextPath(field(form.get('next')) || undefined);
      body =
        action === 'login'
          ? {
              username: field(form.get('username')),
              password: field(form.get('password')),
            }
          : {
              email: field(form.get('email')),
              password: field(form.get('password')),
              data: {
                display_name: field(form.get('displayName')),
                username: field(form.get('username')),
              },
            };
    } else {
      body = (await request.json()) as typeof body;
    }
  }

  if (action === 'logout') {
    const response = formPost
      ? seeOther(nextPath ?? '/')
      : new NextResponse(null, { status: 204 });
    clearAuthCookies(response);
    return response;
  }

  const supabaseUrl = firstSet(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const supabaseKey = firstSet(
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!supabaseUrl || (action === 'register' && !supabaseKey) || !body) {
    return authFailure(
      formPost,
      action,
      nextPath,
      'Supabase authentication is not configured.',
    );
  }

  const endpoint =
    action === 'login'
      ? `${apiBase()}/auth/supabase-login`
      : `${supabaseUrl}/auth/v1/signup`;
  let upstream: Response;

  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body:
        action === 'login'
          ? JSON.stringify({
              username: body.username,
              password: body.password,
            })
          : JSON.stringify({
              email: body.email,
              password: body.password,
              data: body.data,
            }),
      cache: 'no-store',
    });
  } catch {
    return authFailure(
      formPost,
      action,
      nextPath,
      'The authentication service did not respond. Try again.',
    );
  }

  const payload = await upstream.arrayBuffer();

  if (formPost) {
    if (!upstream.ok) {
      return seeOther(failurePath(action, nextPath, messageFrom(payload)));
    }

    const response = seeOther(nextPath ?? '/');
    const session = sessionFrom(payload);

    if (!session) {
      return seeOther(
        failurePath(
          action,
          nextPath,
          'Check your email to confirm your Supabase account, then sign in.',
        ),
      );
    }

    setAuthCookies(response, session);
    return response;
  }

  const response = new NextResponse(payload, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    },
  });

  const session = sessionFrom(payload);

  if (session) {
    setAuthCookies(response, session);
  }

  return response;
}

function firstSet(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

function field(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

function sessionFrom(payload: ArrayBuffer): {
  accessToken: string;
  refreshToken: string;
} | null {
  try {
    const body = JSON.parse(new TextDecoder().decode(payload)) as {
      access_token?: unknown;
      refresh_token?: unknown;
    };

    if (
      typeof body.access_token !== 'string' ||
      typeof body.refresh_token !== 'string'
    ) {
      return null;
    }

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
    };
  } catch {
    return null;
  }
}

function setAuthCookies(
  response: NextResponse,
  session: { accessToken: string; refreshToken: string },
) {
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };

  response.cookies.set(ACCESS_COOKIE, session.accessToken, options);
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, options);
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
}

function authFailure(
  formPost: boolean,
  action: string,
  nextPath: string | null,
  message: string,
): NextResponse {
  if (formPost) {
    return seeOther(failurePath(action, nextPath, message));
  }

  return NextResponse.json({ message }, { status: 503 });
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
