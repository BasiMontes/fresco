/**
 * FRESCO-980 — route-level loading UI for `/historial`, shaped like the page:
 * back button + title and a stack of week rows. See `notifications/loading.tsx`.
 */
export default function HistorialLoading() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden="true" data-testid="historial_loading_skeleton">
      <div className="flex items-center gap-3">
        <div className="size-10 shrink-0 rounded-full bg-border motion-safe:animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-56 rounded bg-border motion-safe:animate-pulse" />
          <div className="h-3 w-36 rounded bg-border motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-card bg-border motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
