/**
 * FRESCO-980 — route-level loading UI for `/notifications`, shaped like the
 * page: back button + title, the welcome card, the route links and the
 * recommended-recipes row. Without it the route fell back to the generic
 * `(app)/loading.tsx` and the layout jumped when the real content arrived.
 *
 * Plain markup, no data, rendered inside the already-painted `AppShell`.
 * `animate-pulse` is dropped under `prefers-reduced-motion` via `motion-safe:`.
 */
export default function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden="true" data-testid="notifications_loading_skeleton">
      <div className="flex items-center gap-3">
        <div className="size-10 shrink-0 rounded-full bg-border motion-safe:animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-52 rounded bg-border motion-safe:animate-pulse" />
          <div className="h-3 w-32 rounded bg-border motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="mt-6 h-28 rounded-card bg-border motion-safe:animate-pulse" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-card bg-border motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-56 rounded-card bg-border motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
