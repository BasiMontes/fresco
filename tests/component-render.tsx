import type { RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * FRESCO-409 — shared entry point for component tests. Re-exports
 * `@testing-library/react` so test files import DOM queries and the render
 * helper from one place, and wraps `render` with whatever app-wide
 * providers a component needs.
 *
 * Today that wrapper is a pass-through: the only app-wide provider is
 * `PostHogProvider` (`app/layout.tsx`), and `posthog-js` is already stubbed
 * in `bun-test-setup.ts`, so components read the stub directly without the
 * provider mounted. The wrapper stays so a future provider (theme, auth,
 * i18n) is a one-line change here, not an edit across every test file.
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, options);
}

/** Fresh `userEvent` instance — call once per test, before interacting. */
export function setupUser() {
  return userEvent.setup();
}

export * from '@testing-library/react';
export { userEvent };
