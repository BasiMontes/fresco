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

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = resolveBaseUrl();

  return [
    {
      url: baseUrl,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
