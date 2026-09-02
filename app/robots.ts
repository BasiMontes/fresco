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
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/qa',
    },
  };
}
