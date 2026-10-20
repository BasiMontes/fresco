import type { MetadataRoute } from 'next';
import { isIndexable } from '@/lib/seo/indexing';
import { resolveBaseUrl } from '@/lib/seo/resolve-base-url';

/**
 * FRESCO-455: `/sitemap.xml` was a 404 (isitagentready.com scan, 2026-09-07),
 * and `robots.txt` carried no `Sitemap:` directive. Base-URL branching comes
 * from `resolveBaseUrl()` (`lib/seo/resolve-base-url.ts`, FRESCO-733), shared
 * with `app/robots.ts` and the `lib/seo/` builders.
 * Only the indexable public routes are listed; every `(app)/` route sits
 * behind auth and `/qa` is a testability guide, not marketing content.
 *
 * FRESCO-473: `/login` and `/signup` were dropped from this list. Both are
 * functional gates (a bare form, no unique marketing copy) that compete with
 * "/" for the same keywords — exactly the thin/duplicate-content risk this
 * ticket calls out. They stay crawlable (no `noindex`, still linked from the
 * landing page) so a visitor or a direct search can still land on them; they
 * just no longer get a sitemap priority hint, which is reserved for pages
 * with real standalone content.
 *
 * FRESCO-474: `lastModified` below is the landing page's actual last
 * git-tracked content change (`git log -1 --format=%ad -- app/page.tsx`),
 * not `new Date()`. This function is statically rendered at build time —
 * a runtime `new Date()` would only ever report "when this build ran",
 * which is not a real modification signal and would make the date churn
 * on every deploy regardless of whether the page changed. Bump the
 * constant by hand when `app/page.tsx` next changes materially; revisit
 * this approach (e.g. a small git-log build step) only if the sitemap
 * grows enough entries that hand-tracking each date stops being cheap.
 */
const LANDING_LAST_MODIFIED = '2026-09-12';

/**
 * FRESCO-1018 (A7-LAUNCH-08): the four legal pages are public, indexable and linked from the sign-up
 * and checkout flows, but the sitemap listed only the landing. Same convention as the landing date:
 * the last git-tracked change of `app/legal` and `lib/legal`, bumped by hand when they change.
 */
const LEGAL_LAST_MODIFIED = '2026-10-19';
const LEGAL_PATHS = ['/legal/privacidad', '/legal/terminos', '/legal/cookies', '/legal/contacto'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  // A closed site (pre, dev, local) lists nothing: `robots.txt` disallows all of it.
  if (!isIndexable()) {
    return [];
  }
  const baseUrl = resolveBaseUrl();

  return [
    {
      url: baseUrl,
      lastModified: LANDING_LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...LEGAL_PATHS.map(path => ({
      url: `${baseUrl}${path}`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ];
}
