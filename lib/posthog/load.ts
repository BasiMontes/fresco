// `posthog-js` is lazy-loaded so the SDK never ships in the initial JS of a
// page that does not capture anything yet (cookie consent gates `init()`).
// One cached import promise for the whole client bundle: every caller shares
// the same module resolution instead of re-importing.
let posthogModulePromise: Promise<typeof import('posthog-js')> | null = null;

export async function loadPosthog(): Promise<typeof import('posthog-js')> {
  posthogModulePromise ??= import('posthog-js');
  return posthogModulePromise;
}
