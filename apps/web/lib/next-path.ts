export function safeNextPath(value: string | undefined): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('://')
  ) {
    return null;
  }

  if (
    value.startsWith('/join/') ||
    value === '/settings' ||
    value.startsWith('/settings?') ||
    value.startsWith('/circles')
  ) {
    return value;
  }

  return null;
}
