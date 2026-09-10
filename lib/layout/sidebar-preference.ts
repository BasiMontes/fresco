/**
 * Desktop sidebar collapse preference (FRESCO-485).
 *
 * Stored in a plain cookie — same pattern and reasoning as the theme
 * preference (`lib/theme/theme.ts`): `app/(app)/layout.tsx` reads it per
 * request and passes the value into the shell, so the sidebar renders at
 * the right width on the first byte with no flash and no layout shift.
 *
 * Cookie value: exactly `"1"` means collapsed; anything else (including
 * absent) means expanded, the default.
 */
export const SIDEBAR_COLLAPSED_COOKIE = 'sidebar_collapsed';

/** 1 year — a UI preference, safe to persist long (matches the theme cookie). */
export const SIDEBAR_COLLAPSED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Server- or client-side: is the sidebar collapsed for this raw cookie value? */
export function parseSidebarCollapsed(value: string | undefined | null): boolean {
  return value === '1';
}

/** Client-side read of the current preference from `document.cookie`. */
export function readSidebarCollapsedClient(): boolean {
  if (typeof document === 'undefined') { return false; }
  const match = document.cookie.match(new RegExp(`(?:^|; )${SIDEBAR_COLLAPSED_COOKIE}=([^;]*)`));
  return parseSidebarCollapsed(match?.[1]);
}

/** Client-side write — the server picks it up on the next request. */
export function writeSidebarCollapsed(collapsed: boolean): void {
  if (typeof document === 'undefined') { return; }
  document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${collapsed ? '1' : '0'}; path=/; max-age=${SIDEBAR_COLLAPSED_COOKIE_MAX_AGE}; samesite=lax`;
}
