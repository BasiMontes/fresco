import type { MetadataRoute } from 'next';

/**
 * FRESCO-455: `/sitemap.xml` was a 404 (isitagentready.com scan, 2026-09-07),
 * and `robots.txt` carried no `Sitemap:` directive. Base-URL branching
 * mirrors `resolveAppUrl()` in `lib/stripe.ts` — kept standalone (no cross
 * import) to match `app/robots.ts`'s existing no-domain-coupling convention.
 * Only the indexable public routes are listed; every `(app)/` route sits
 * behind auth and `/qa` is a testability guide, not marketing content.
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
    {
      url: `${baseUrl}/login`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
