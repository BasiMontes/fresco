/**
 * "Cómo aprenden tus menús" card dismiss preference (FRESCO-512).
 *
 * Same pattern as `lib/layout/sidebar-preference.ts`: a plain cookie,
 * read server-side in `app/(app)/calendar/page.tsx` so the reopen link
 * (or the card) renders at the right state on the first byte.
 *
 * Cookie value: exactly `"1"` means dismissed; anything else (including
 * absent) means shown, the default.
 */
export const LEARNING_BRIDGE_DISMISSED_COOKIE = 'learning_bridge_dismissed';

/** 1 year — a UI preference, safe to persist long (matches the sidebar cookie). */
export const LEARNING_BRIDGE_DISMISSED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Server- or client-side: is the card dismissed for this raw cookie value? */
export function parseLearningBridgeDismissed(value: string | undefined | null): boolean {
  return value === '1';
}

/** Client-side write — the server picks it up on the next request. */
export function writeLearningBridgeDismissed(dismissed: boolean): void {
  if (typeof document === 'undefined') { return; }
  document.cookie = `${LEARNING_BRIDGE_DISMISSED_COOKIE}=${dismissed ? '1' : '0'}; path=/; max-age=${LEARNING_BRIDGE_DISMISSED_COOKIE_MAX_AGE}; samesite=lax`;
}
