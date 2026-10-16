/**
 * FRESCO-980 — route-level loading UI for `/favorites`, shaped like the page:
 * back button + title and the recipe grid with the same breakpoints as
 * `FavoritesGrid` (2 / 3 / 4 columns). See `notifications/loading.tsx`.
 */
export default function FavoritesLoading() {
  return (
    <div className="mx-auto max-w-5xl" aria-hidden="true" data-testid="favorites_loading_skeleton">
      <div className="flex items-center gap-3">
        <div className="size-10 shrink-0 rounded-full bg-border motion-safe:animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-44 rounded bg-border motion-safe:animate-pulse" />
          <div className="h-3 w-40 rounded bg-border motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-64 rounded-card bg-border motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
