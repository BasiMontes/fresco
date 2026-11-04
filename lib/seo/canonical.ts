import { resolveBaseUrl } from './resolve-base-url';

/**
 * FRESCO-471: shared self-referencing canonical URL builder for the App
 * Router `alternates.canonical` metadata field.
 *
 * Every route builds its canonical from this static `pathname`, never from
 * the incoming request URL — that's what keeps tracking query params
 * (`?utm_source=...`) and trailing-slash variants out of the emitted URL.
 */

/** Absolute base URL as a `URL`, for `metadata.metadataBase` in the root layout. */
export function getMetadataBase(): URL {
  return new URL(resolveBaseUrl());
}

/**
 * FRESCO-1113 (A8-LAUNCH-03): Next.js resolves the file-based `opengraph-image` URL against
 * `VERCEL_BRANCH_URL` on every Vercel preview build, ignoring `metadataBase`, so pre's `og:image`
 * pointed at the SSO-protected `fresco-git-staging-...` host. Pointing that variable at the
 * environment's own host makes the image resolve to the one people share. Called from the root
 * layout before its `metadata` is read; a no-op outside preview builds.
 */
export function pinSocialImageOrigin(): void {
  if (process.env.VERCEL_ENV !== 'preview') {
    return;
  }
  process.env.VERCEL_BRANCH_URL = getMetadataBase().host;
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
