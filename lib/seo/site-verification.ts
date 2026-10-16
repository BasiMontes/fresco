import type { Metadata } from 'next';

/**
 * FRESCO-887: ownership-verification meta tags for Google Search Console and
 * Bing Webmaster Tools. The codes are per-property secrets-by-obscurity, so
 * they come from the environment (`GOOGLE_SITE_VERIFICATION`,
 * `BING_SITE_VERIFICATION`) and no tag is emitted for a variable left unset.
 */
type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function getSiteVerification(env: Env = process.env): Metadata['verification'] {
  const google = clean(env.GOOGLE_SITE_VERIFICATION);
  const bing = clean(env.BING_SITE_VERIFICATION);
  if (!google && !bing) { return undefined; }

  return {
    ...(google && { google }),
    ...(bing && { other: { 'msvalidate.01': bing } }),
  };
}
