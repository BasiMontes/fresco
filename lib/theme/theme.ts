/**
 * Theme preference contract (FRESCO-448 §Dark mode, epic FRESCO-436).
 *
 * The app ships a light "warm cream editorial" look and a dark "deep
 * green-black paper" counterpart. The preference is stored in a plain cookie
 * (not `localStorage`) so `app/layout.tsx` can read it per request and stamp
 * `data-theme` on `<html>` server-side — no flash, no inline script.
 *
 * - `light` / `dark` — explicit override, wins over the OS. `light` is also
 *   the first-visit default (no cookie set yet) — a clean, predictable
 *   impression regardless of the visitor's OS setting.
 * - `system` — explicit user choice to follow `prefers-color-scheme`,
 *   represented by the ABSENCE of the `data-theme` attribute (cookie cleared).
 */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_COOKIE = 'theme';

/** 1 year — a UI preference, safe to persist long. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Apply a preference on the client: set (or clear, for `system`) the cookie
 * and reflect it on `<html>` immediately so the swap is instant without a
 * reload. The server picks up the same cookie on the next request.
 */
export function applyThemePreference(preference: ThemePreference): void {
  if (typeof document === 'undefined') { return; }

  if (preference === 'system') {
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = 'light dark';
    return;
  }

  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = preference;
}
