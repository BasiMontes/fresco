import type { Metadata } from 'next';

/**
 * FRESCO-1018 (audit 7b, A7-LAUNCH-07): only the production deployment may be indexed. `fresco-pre`
 * and `fresco-dev` are copies of the same landing, so left open they compete with `fresco-pro` for the
 * same queries and can outrank it. Vercel sets `VERCEL_ENV` to `production` on the production
 * deployment only (`preview` on pre and dev); a local run has none and counts as not indexable.
 */
export function isIndexable(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === 'production';
}

/** `robots` metadata for the root layout: nothing on production, `noindex, nofollow` everywhere else. */
export function indexingRobots(env: Record<string, string | undefined> = process.env): Metadata['robots'] {
  return isIndexable(env) ? undefined : { index: false, follow: false };
}
