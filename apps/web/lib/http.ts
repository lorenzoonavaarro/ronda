export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
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
