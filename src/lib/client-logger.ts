const isBrowser = typeof window !== 'undefined';

// Enable verbose client logs only when explicitly requested.
const shouldLogDebug =
  isBrowser &&
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_VERBOSE_CLIENT_LOGS === 'true';

export function logDebug(...args: unknown[]): void {
  if (!shouldLogDebug) return;
  console.log(...args);
}

export function warnDebug(...args: unknown[]): void {
  if (!shouldLogDebug) return;
  console.warn(...args);
}
