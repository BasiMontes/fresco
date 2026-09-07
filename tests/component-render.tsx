import type { RenderOptions, Screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * FRESCO-409 — shared entry point for component tests. Re-exports
 * `@testing-library/react` so test files pull DOM queries + the render
 * helper from one place, and wraps `render` with whatever app-wide
 * providers a component needs.
 *
 * The wrapper is a pass-through: `PostHogProvider` (`app/layout.tsx`) reads
 * its consent decision from `useCookieConsent()`, and `SiteFooter` /
 * `AyudaSection` (FRESCO-428) call that same hook directly — none of those
 * are wrapped here, so a test rendering any of them (or anything under
 * `PostHogProvider`) THROUGH this helper still needs its own
 * `<CookieConsentProvider initialDecision={...}>` wrapper, same as the test
 * files under `components/legal/` and `app/providers/posthog-provider.test.tsx`
 * already do. Not folded in globally: most component tests render neither
 * PostHog- nor consent-aware components, and a blanket wrapper here would
 * change what every one of those tests actually exercises.
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, options);
}

/** Fresh `userEvent` instance — call once per test, before interacting. */
export function setupUser() {
  return userEvent.setup();
}

/**
 * `@testing-library/dom`'s own `screen` binds `document.body` once, at
 * import time. `bun-test-setup.ts` may re-register happy-dom between test
 * files (the CI window-global fix), which swaps `document` for a fresh one
 * — leaving the stock `screen` pointed at a detached body. This proxy
 * re-derives the query set from the *live* `document.body` on every access.
 */
export const screen: Screen = new Proxy({} as Screen, {
  get(_target, prop: string) {
    return Reflect.get(within(document.body), prop);
  },
});

export * from '@testing-library/react';
export { userEvent };

/**
 * FRESCO-428 — was hand-copied identically into `lib/consent/cookie-consent.test.ts`,
 * `components/legal/cookie-consent-banner.test.tsx`, and
 * `components/legal/cookie-settings-dialog.test.tsx` (found in code review).
 * Shared here so a future change to test cookie-clearing semantics is one edit.
 */
export function clearAllCookies() {
  document.cookie.split(';').forEach((entry) => {
    const name = entry.split('=')[0]?.trim();
    if (name) { document.cookie = `${name}=; path=/; max-age=0`; }
  });
}
