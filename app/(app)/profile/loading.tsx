/**
 * FRESCO-490 — loading UI for `/profile`. Mirrors `page.tsx`'s structure
 * (title, account card, three stacked single-column cards, a two-column
 * Preferencias/Ayuda row, then two footer cards) so the real content swaps
 * in without a layout shift.
 *
 * Content-only, like `app/(app)/loading.tsx`: it renders inside the already-
 * painted `<AppShell>`, so no sidebar / bottom bar here. Plain markup, no
 * data. `animate-pulse` is dropped under `prefers-reduced-motion` via
 * `motion-safe:`.
 */
function SkeletonCard({ children, className }: { children?: React.ReactNode, className?: string }) {
  return (
    <div className={`rounded-card border border-border bg-surface-raised p-3 ${className ?? ''}`}>
      {children}
    </div>
  );
}

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl" aria-hidden="true" data-testid="profile_skeleton">
      <div className="h-9 w-32 rounded bg-border motion-safe:animate-pulse" />

      <SkeletonCard className="mt-6">
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 rounded-full bg-border motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-border motion-safe:animate-pulse" />
            <div className="h-3 w-56 rounded bg-border motion-safe:animate-pulse" />
          </div>
        </div>
      </SkeletonCard>

      <div className="mt-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="h-28">
            <div className="h-4 w-32 rounded bg-border motion-safe:animate-pulse" />
            <div className="mt-3 h-10 rounded bg-border motion-safe:animate-pulse" />
          </SkeletonCard>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} className="h-48">
            <div className="h-4 w-28 rounded bg-border motion-safe:animate-pulse" />
            <div className="mt-3 h-28 rounded bg-border motion-safe:animate-pulse" />
          </SkeletonCard>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24">
            <div className="h-4 w-24 rounded bg-border motion-safe:animate-pulse" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
