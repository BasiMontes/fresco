/**
 * FRESCO-471: shared self-referencing canonical URL builder for the App
 * Router `alternates.canonical` metadata field. Base-URL branching mirrors
 * `app/sitemap.ts` / `app/robots.ts` (and `resolveAppUrl()` in `lib/stripe.ts`)
 * — kept standalone, no cross-import, to match their existing
 * no-domain-coupling convention, so all four stay in lockstep by inspection.
 *
 * Every route builds its canonical from this static `pathname`, never from
 * the incoming request URL — that's what keeps tracking query params
 * (`?utm_source=...`) and trailing-slash variants out of the emitted URL.
 */
function resolveBaseUrl(): string {
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://fresco-pro.vercel.app';
  }
  if (process.env.VERCEL_ENV === 'preview') {
    return process.env.VERCEL_GIT_COMMIT_REF === 'dev'
      ? 'https://fresco-dev.vercel.app'
      : 'https://fresco-pre.vercel.app';
  }
  return 'http://localhost:3000';
}

/** Absolute base URL as a `URL`, for `metadata.metadataBase` in the root layout. */
export function getMetadataBase(): URL {
  return new URL(resolveBaseUrl());
}

/**
 * Builds the absolute, self-referencing canonical URL for a route's static
 * path (e.g. `/login`). Pass `/` for the root route — the base URL is
 * returned with no trailing slash appended, matching `app/sitemap.ts`'s
 * existing `url: baseUrl` convention for the same route.
 */
export function canonicalUrl(pathname: string): string {
  const base = resolveBaseUrl();
  return pathname === '/' ? base : `${base}${pathname}`;
}
