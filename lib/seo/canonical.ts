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
 * Builds the absolute, self-referencing canonical URL for a route's static
 * path (e.g. `/login`). Pass `/` for the root route — the base URL is
 * returned with no trailing slash appended, matching `app/sitemap.ts`'s
 * existing `url: baseUrl` convention for the same route.
 */
export function canonicalUrl(pathname: string): string {
  const base = resolveBaseUrl();
  return pathname === '/' ? base : `${base}${pathname}`;
}
