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
 * Today the wrapper is a pass-through: the only app-wide provider is
 * `PostHogProvider` (`app/layout.tsx`), and `posthog-js` is stubbed in
 * `bun-test-setup.ts`, so components read the stub directly. The wrapper
 * stays so a future provider (theme, auth, i18n) is a one-line change here.
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
