import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

/**
 * FRESCO-409 — `@testing-library/jest-dom` self-registers its matchers on
 * `bun:test`'s `expect` at import time (in `bun-test-setup.ts`), but ships
 * no types for that runner. Augment `bun:test`'s `Matchers` so
 * `toBeInTheDocument`, `toHaveAttribute`, `toBeChecked`, … typecheck.
 */
declare module 'bun:test' {
  interface Matchers<_T> extends TestingLibraryMatchers<unknown, void> {}
  interface AsymmetricMatchers extends TestingLibraryMatchers<unknown, void> {}
}
