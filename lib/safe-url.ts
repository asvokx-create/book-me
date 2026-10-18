export function safeHttpUrl(value: string, base?: string, requiredOrigin?: string) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (requiredOrigin && url.origin !== new URL(requiredOrigin).origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}
