export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000';

  if (typeof window === 'undefined') {
    return configured;
  }

  try {
    const url = new URL(configured);
    const pageHost = window.location.hostname;
    const localHost =
      url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    const localPage = pageHost === '127.0.0.1' || pageHost === 'localhost';

    if (localHost && localPage) {
      url.hostname = pageHost;
    }

    return url.origin;
  } catch {
    return configured;
  }
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };

    if (typeof body.message === 'string') {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.join(' ');
    }
  } catch {
    return 'Something went wrong. Try again.';
  }

  return 'Something went wrong. Try again.';
}
