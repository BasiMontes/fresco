import { safeNextPath } from '@/lib/auth/safe-next-path';

/**
 * FRESCO-1014 (A7-UI-16) — an expired session no longer drops the destination. A protected page redirects to
 * `/login?next=<path>` and the login sends the person back there. Both ends go through `safeNextPath`
 * (FRESCO-364), so the parameter can only ever name a path of this app.
 */

/** Where a protected page sends a visitor without a session. `/` and `/menu` need no memory of the destination. */
export function loginUrlFor(requestedPath: string | null | undefined): string {
  const next = safeNextPath(requestedPath);
  return next === '/' || next === '/menu' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}

/** Where the login goes after a successful sign-in: the remembered destination, or `/menu`. */
export function postLoginPath(next: string | null | undefined): string {
  const target = safeNextPath(next);
  return target === '/' || target.startsWith('/login') ? '/menu' : target;
}
