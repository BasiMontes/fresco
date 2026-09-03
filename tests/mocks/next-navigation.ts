import { mock } from 'bun:test';

/**
 * FRESCO-409 — shared `next/navigation` stub for component tests. `bun test`
 * runs every file in one process and `mock.module` is process-global, so
 * importing this once mocks `useRouter` etc. for the whole run; no `lib/`
 * logic test imports `next/navigation`, so nothing else is affected.
 *
 * Import for the side effect, then read `routerMock` to assert navigations
 * (call `.mockClear()` in a `beforeEach`).
 */
export const routerMock = {
  push: mock(() => {}),
  replace: mock(() => {}),
  refresh: mock(() => {}),
  back: mock(() => {}),
  forward: mock(() => {}),
  prefetch: mock(() => {}),
};

/** Mutable — set `navState.pathname` in a test before rendering a component that reads `usePathname()`. */
export const navState = { pathname: '/', searchParams: new URLSearchParams() };

void mock.module('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => navState.pathname,
  useSearchParams: () => navState.searchParams,
  useParams: () => ({}),
  redirect: mock(() => {}),
  notFound: mock(() => {}),
}));
