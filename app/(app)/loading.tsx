import { AppShellSkeleton } from '@/components/layout/app-shell-skeleton';

/**
 * FRESCO-482 — route-group loading UI for `(app)/`. Next shows this while any
 * page under `(app)/` resolves its server data, so the authenticated area
 * never flashes blank or looks frozen between navigations. The per-route
 * `loading.tsx` files (`menu/`, `calendar/`, …) still win for their own
 * segments; this covers the rest.
 */
export default function AppLoading() {
  return <AppShellSkeleton />;
}
