export function visibleError(
  value: string | string[] | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();

  return cleaned ? cleaned.slice(0, 200) : null;
}
