/**
 * FRESCO-482 — the loading state for the authenticated area, shown by
 * `app/(app)/loading.tsx` while a route under `(app)/` resolves its data.
 * Mirrors `components/layout/app-shell.tsx` (desktop sidebar + content
 * column, mobile bottom bar) so the real content swaps in without a layout
 * shift.
 *
 * Plain markup, no data: it renders before the session is even resolved.
 * `animate-pulse` is dropped under `prefers-reduced-motion` via the
 * `motion-reduce:animate-none` variant.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-background" aria-hidden="true" data-testid="app_shell_skeleton">
      {/* Desktop sidebar — matches Sidebar's `hidden w-64 bg-primary md:flex` */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-primary px-4 py-6 md:flex">
        <div className="mx-2 h-8 w-28 rounded bg-background/15" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-background/10 motion-safe:animate-pulse" />
          ))}
        </div>
        <div className="mt-auto h-12 rounded bg-background/10" />
      </aside>

      {/* Content column */}
      <main className="min-w-0 flex-1 px-4 py-8 pb-24 md:px-8 md:pb-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="h-8 w-48 rounded bg-border motion-safe:animate-pulse" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded bg-border motion-safe:animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 rounded bg-border motion-safe:animate-pulse" />
            ))}
          </div>
        </div>
      </main>

      {/* Mobile bottom bar — matches BottomTabBar's fixed strip */}
      <div className="fixed inset-x-0 bottom-0 flex h-16 items-center justify-around border-t border-border bg-surface-raised md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="size-6 rounded bg-border" />
        ))}
      </div>
    </div>
  );
}
