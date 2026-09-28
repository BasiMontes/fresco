/**
 * FRESCO-733 (A5-H3): single source of truth for the base-URL branching
 * previously copy-pasted across `lib/seo/canonical.ts`,
 * `lib/seo/structured-data.ts`, `app/sitemap.ts`, and `app/robots.ts`
 * (originally kept standalone per FRESCO-471/472/455 to avoid a cross-module
 * import for a ten-line env branch — now consolidated since 4 copies is the
 * actual duplication cost the no-cross-import call was trying to avoid).
 */
export function resolveBaseUrl(): string {
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
