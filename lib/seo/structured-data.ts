/**
 * JSON-LD structured-data builders for the public marketing pages (FRESCO-472).
 *
 * `resolveBaseUrl()` mirrors the branching in `app/sitemap.ts` / `app/robots.ts`
 * / `lib/stripe.ts` (FRESCO-455) — kept standalone per those files' existing
 * no-domain-coupling convention rather than importing across modules for a
 * ten-line env branch.
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

export interface FaqEntry {
  question: string
  answer: string
}

/** schema.org Organization — no `sameAs`: the codebase has no confirmed social profile links (footer + nav checked). */
export function organizationJsonLd() {
  const baseUrl = resolveBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'Fresco',
    'url': baseUrl,
    'logo': `${baseUrl}/brand/logo-base.svg`,
  };
}

export function websiteJsonLd() {
  const baseUrl = resolveBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'Fresco',
    'url': baseUrl,
  };
}

/**
 * schema.org SoftwareApplication. Pricing mirrors `components/landing/pricing.tsx`
 * (Free 0€/mes, Pro 4,99€/mes) — the only prices that exist in the codebase.
 * `aggregateRating` is deliberately omitted: no real rating data exists yet.
 */
export function softwareApplicationJsonLd() {
  const baseUrl = resolveBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': 'Fresco',
    'description':
      'Fresco genera tu menú semanal en menos de 30 segundos y aprende de lo que realmente cocinas cada semana.',
    'url': baseUrl,
    'applicationCategory': 'LifestyleApplication',
    'operatingSystem': 'Web',
    'offers': [
      { '@type': 'Offer', 'name': 'Free', 'price': '0', 'priceCurrency': 'EUR' },
      { '@type': 'Offer', 'name': 'Pro', 'price': '4.99', 'priceCurrency': 'EUR' },
    ],
  };
}

/**
 * schema.org FAQPage, derived from the same `faqs` array the visible FAQ
 * accordion maps over — single source of truth, no hand-duplicated copy.
 */
export function faqJsonLd(faqs: readonly FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer,
      },
    })),
  };
}
