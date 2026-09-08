import type { MetadataRoute } from 'next';

/**
 * FRESCO-315: `/robots.txt` was a 404 on a landing that otherwise has a
 * curated title + meta description. The public marketing pages are all
 * meant to be indexed; every `(app)/` route redirects unauthenticated
 * crawlers to `/login`, so a blanket allow is correct.
 *
 * FRESCO-395 (A4-L5): `/qa` is a public testability guide, not marketing —
 * it should never be indexed (it also carries `robots: noindex` in its own
 * metadata; this is the belt-and-suspenders disallow).
 *
 * FRESCO-455: base-URL branching mirrors `app/sitemap.ts` (and
 * `resolveAppUrl()` in `lib/stripe.ts`) so crawlers get a `Sitemap:` pointer.
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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/qa',
    },
    sitemap: `${resolveBaseUrl()}/sitemap.xml`,
  };
}
