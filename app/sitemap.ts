import type { MetadataRoute } from 'next';

/**
 * FRESCO-455: `/sitemap.xml` was a 404 (isitagentready.com scan, 2026-09-07),
 * and `robots.txt` carried no `Sitemap:` directive. Base-URL branching
 * mirrors `resolveAppUrl()` in `lib/stripe.ts` — kept standalone (no cross
 * import) to match `app/robots.ts`'s existing no-domain-coupling convention.
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

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = resolveBaseUrl();

  return [
    {
      url: baseUrl,
      lastModified: LANDING_LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
