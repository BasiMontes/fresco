/**
 * FRESCO-482 / FRESCO-490 — route-group loading UI for `(app)/`. Next shows
 * this while any page under `(app)/` without its own `loading.tsx` resolves
 * its server data, so the authenticated area never flashes blank between
 * navigations. The per-route `loading.tsx` files (`menu/`, `calendar/`,
 * `profile/`, …) still win for their own segments; this covers the rest.
 *
 * Content-only: it renders as the page slot INSIDE `app/(app)/layout.tsx`'s
 * already-painted `<AppShell>` (sidebar + `<main>` padding), so it must NOT
 * draw its own shell — the old full-shell skeleton double-rendered the
 * sidebar (a stray `bg-primary` block) and the mobile bottom bar (FRESCO-490).
 *
 * Plain markup, no data. `animate-pulse` is dropped under
 * `prefers-reduced-motion` via `motion-safe:`.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8" aria-hidden="true" data-testid="app_content_skeleton">
      <div className="h-8 w-48 rounded bg-border motion-safe:animate-pulse" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-card bg-border motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
