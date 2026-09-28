import type { MetadataRoute } from 'next';
import { resolveBaseUrl } from '@/lib/seo/resolve-base-url';

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
 * FRESCO-455: base-URL branching comes from `resolveBaseUrl()`
 * (`lib/seo/resolve-base-url.ts`, FRESCO-733), shared with `app/sitemap.ts`,
 * so crawlers get a `Sitemap:` pointer.
 *
 * FRESCO-473: `/auth/confirm` is a Route Handler (a one-shot Supabase
 * email-link redirect, never renders HTML) — it can't carry a `<meta
 * name="robots">` tag like the other noindexed routes, so the disallow lives
 * here instead.
 *
 * FRESCO-474: the blanket `allow: '/'` above only ever meant "the public
 * marketing surface", but nothing actually blocked a crawler from wandering
 * into `/api` or any `(app)/` route — those redirect an unauthenticated
 * crawler to `/login` (see FRESCO-315 above), which just wastes crawl
 * budget on a login wall instead of real content. The `(app)/` list below
 * is read straight off `app/(app)/*` (grepped, not from memory): `/admin`
 * covers `/admin/recipes` too, and `/recipes` covers `/recipes/[id]` — a
 * `Disallow` value is a path-prefix match, so no per-subroute entries are
 * needed. `/qa` and `/auth/confirm` are unchanged from FRESCO-395/473.
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api',
        '/admin',
        '/calendar',
        '/favorites',
        '/historial',
        '/menu',
        '/notifications',
        '/profile',
        '/recipes',
        '/shopping-list',
        '/qa',
        '/auth/confirm',
      ],
    },
    sitemap: `${resolveBaseUrl()}/sitemap.xml`,
  };
}
