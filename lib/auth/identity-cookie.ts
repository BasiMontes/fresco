/**
 * Landing-nav identity hint (FRESCO-486).
 *
 * A first-party functional cookie holding the signed-in user's display name
 * (`user_profiles.nombre`). Written client-side on sign-in and cleared on
 * sign-out by `IdentityCookieSync` (`app/layout.tsx`); read by the landing
 * nav (`components/landing/site-nav.tsx`) so a returning logged-in visitor
 * is greeted without a name query on the render path.
 *
 * NOT the source of truth for "is this visitor logged in" — that stays a
 * client `getSession()` read. This cookie only supplies the name; a stale
 * copy never forces a logged-in nav.
 *
 * Same plain-cookie shape as `lib/theme/theme.ts`: not `httpOnly` (the
 * client reads it), `samesite=lax`, `path=/`. It carries a display name
 * tied to a session the user explicitly created, so it is a functional
 * cookie, not analytics — written regardless of cookie-consent state, like
 * the theme cookie (and unlike anything in `posthog-provider.tsx`).
 */
export const IDENTITY_NOMBRE_COOKIE = 'fresco_nombre';

/** 30 days — a convenience hint, re-written on every sign-in. */
export const IDENTITY_NOMBRE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Fired on `window` whenever the cookie is written or cleared, so a
 * component that already read it once (the landing nav) can pick up a
 * change that landed after its own mount — e.g. `IdentityCookieSync`'s
 * `user_profiles` query resolving just after the nav's first paint.
 */
export const IDENTITY_COOKIE_EVENT = 'fresco:identity-cookie';

function emitChange(): void {
  if (typeof window === 'undefined') { return; }
  window.dispatchEvent(new Event(IDENTITY_COOKIE_EVENT));
}

export function writeNombreCookie(nombre: string): void {
  if (typeof document === 'undefined') { return; }
  // Cap the length — a display name is short, and this keeps a pathological
  // value well clear of the ~4KB cookie limit (past which the browser drops
  // it silently).
  const trimmed = nombre.trim().slice(0, 80);
  if (!trimmed) { clearNombreCookie(); return; }
  document.cookie = `${IDENTITY_NOMBRE_COOKIE}=${encodeURIComponent(trimmed)}; path=/; max-age=${IDENTITY_NOMBRE_COOKIE_MAX_AGE}; samesite=lax`;
  emitChange();
}

export function clearNombreCookie(): void {
  if (typeof document === 'undefined') { return; }
  document.cookie = `${IDENTITY_NOMBRE_COOKIE}=; path=/; max-age=0; samesite=lax`;
  emitChange();
}

export function readNombreCookie(): string | null {
  if (typeof document === 'undefined') { return null; }
  const match = document.cookie.match(new RegExp(`(?:^|; )${IDENTITY_NOMBRE_COOKIE}=([^;]*)`));
  if (!match?.[1]) { return null; }
  try {
    const value = decodeURIComponent(match[1]).trim();
    return value || null;
  }
  catch {
    // A malformed percent-encoding — treat as absent rather than throw.
    return null;
  }
}
