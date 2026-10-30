/**
 * FRESCO-1070 — loading UI for `/profile/preferences`. Mirrors `page.tsx` (back button and title,
 * then one tall card) so the real content swaps in without a layout shift. Content-only, like
 * `app/(app)/loading.tsx`: it renders inside the already-painted `<AppShell>`.
 */
export default function ProfilePreferencesLoading() {
  return (
    <div className="mx-auto max-w-4xl" aria-hidden="true" data-testid="preferences_skeleton">
      <div className="flex items-center gap-3">
        <div className="size-10 shrink-0 rounded-full bg-border motion-safe:animate-pulse" />
        <div className="h-9 w-40 rounded bg-border motion-safe:animate-pulse" />
      </div>

      <div className="mt-4 h-[32rem] rounded-card border border-border bg-surface-raised p-3">
        <div className="h-4 w-32 rounded bg-border motion-safe:animate-pulse" />
        <div className="mt-3 h-10 rounded bg-border motion-safe:animate-pulse" />
        <div className="mt-6 h-4 w-40 rounded bg-border motion-safe:animate-pulse" />
        <div className="mt-3 h-24 rounded bg-border motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
