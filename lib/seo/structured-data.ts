import { resolveBaseUrl } from './resolve-base-url';

/**
 * JSON-LD structured-data builders for the public marketing pages (FRESCO-472).
 */

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

/**
 * `about` (FRESCO-508): the site's core entities, as bare `Thing` nodes — no
 * `url` per entity, since none has a standalone public page to point at
 * (`/recipes` and the meal-plan/shopping-list flows sit behind auth).
 */
export function websiteJsonLd() {
  const baseUrl = resolveBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'Fresco',
    'url': baseUrl,
    'about': [
      { '@type': 'Thing', 'name': 'Menú semanal', 'description': 'Planificación automática del menú de la semana según lo que el usuario cocina.' },
      { '@type': 'Thing', 'name': 'Lista de la compra', 'description': 'Lista de la compra generada a partir del menú semanal.' },
      { '@type': 'Thing', 'name': 'Recetas', 'description': 'Catálogo de recetas usado para generar el menú semanal.' },
    ],
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

/**
 * FRESCO-816 (audit-6 A6-S14): the JSON placed inside a `<script type="application/ld+json">`.
 * `JSON.stringify` leaves `<` as is, so a value containing `</script>` would end the block
 * and let the rest run as markup. Escaping `<` (and the two line separators some parsers
 * treat as newlines) keeps it data; the escaped text still parses to the same value.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
