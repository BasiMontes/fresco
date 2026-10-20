import { describe, expect, test } from 'bun:test';
import {
  faqJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from './structured-data';

/**
 * FRESCO-472 — schema.org shape checks (no Google Rich Results Test / Schema.org
 * Validator available in this environment, so this pins the required
 * properties + types by hand against each type's spec).
 */

describe('organizationJsonLd', () => {
  test('is a valid, well-formed Organization block', () => {
    const data = organizationJsonLd();

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('Organization');
    expect(typeof data.name).toBe('string');
    expect(data.url).toMatch(/^https?:\/\//);
    expect(data.logo).toMatch(/^https?:\/\/.+\.svg$/);
    expect(() => JSON.stringify(data)).not.toThrow();
  });
});

describe('websiteJsonLd', () => {
  test('is a valid, well-formed WebSite block', () => {
    const data = websiteJsonLd();

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('WebSite');
    expect(typeof data.name).toBe('string');
    expect(data.url).toMatch(/^https?:\/\//);
  });

  test('lists the site\'s core entities under about (FRESCO-508)', () => {
    const data = websiteJsonLd();

    expect(data.about.length).toBeGreaterThan(0);
    data.about.forEach((entity) => {
      expect(entity['@type']).toBe('Thing');
      expect(typeof entity.name).toBe('string');
      expect(typeof entity.description).toBe('string');
    });
  });
});

describe('softwareApplicationJsonLd', () => {
  const stripe = { month: 4.99, year: 49.9, taxIncluded: true };

  test('is a valid SoftwareApplication block with Free + Pro offers', () => {
    const data = softwareApplicationJsonLd(stripe);

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('SoftwareApplication');
    expect(typeof data.name).toBe('string');
    expect(typeof data.description).toBe('string');
    expect(typeof data.applicationCategory).toBe('string');
    expect(typeof data.operatingSystem).toBe('string');
    data.offers.forEach((offer) => {
      expect(offer['@type']).toBe('Offer');
      expect(typeof offer.price).toBe('string');
      expect(offer.priceCurrency).toBe('EUR');
    });
  });

  test('the Pro offers carry exactly the prices Stripe reports (FRESCO-1018)', () => {
    const offers = softwareApplicationJsonLd(stripe).offers;

    expect(offers.map(offer => [offer.name, offer.price])).toEqual([['Free', '0'], ['Pro', '4.99'], ['Pro anual', '49.90']]);
  });

  test('a changed Stripe price changes the structured data, with two decimals', () => {
    const offers = softwareApplicationJsonLd({ month: 6, year: null, taxIncluded: false }).offers;

    expect(offers.map(offer => offer.price)).toEqual(['0', '6.00']);
  });

  test('without an annual price there is no annual offer', () => {
    expect(softwareApplicationJsonLd({ month: 4.99, year: null, taxIncluded: false }).offers.map(offer => offer.name)).toEqual(['Free', 'Pro']);
  });

  test('when Stripe cannot be read the Pro offer carries no price, never a stale one', () => {
    const offers = softwareApplicationJsonLd(null).offers;

    expect(offers[0]).toMatchObject({ name: 'Free', price: '0' });
    expect(offers[1]).toEqual({ '@type': 'Offer', 'name': 'Pro' });
    expect(offers).toHaveLength(2);
  });

  test('has no aggregateRating — no real review data exists', () => {
    const data = softwareApplicationJsonLd(stripe);

    expect(data).not.toHaveProperty('aggregateRating');
  });
});

describe('faqJsonLd', () => {
  const faqs = [
    { question: '¿Uno?', answer: 'Uno.' },
    { question: '¿Dos?', answer: 'Dos.' },
  ];

  test('derives one Question per FAQ entry, in order, with no content drift', () => {
    const data = faqJsonLd(faqs);

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(faqs.length);
    data.mainEntity.forEach((entry, index) => {
      expect(entry['@type']).toBe('Question');
      expect(entry.name).toBe(faqs[index].question);
      expect(entry.acceptedAnswer['@type']).toBe('Answer');
      expect(entry.acceptedAnswer.text).toBe(faqs[index].answer);
    });
  });

  test('produces an empty mainEntity for an empty FAQ source', () => {
    expect(faqJsonLd([]).mainEntity).toEqual([]);
  });
});

describe('serializeJsonLd', () => {
  test('escapes < so a value cannot close the script block (A6-S14)', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });

    expect(out).not.toContain('<');
    expect(out).toContain('\\u003c/script>');
  });

  test('the escaped text parses back to exactly the same value', () => {
    const data = { name: 'a </script> b', note: 'línea\u2028separada\u2029otra', n: 3, tags: ['<b>'] };

    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  test('leaves the real schema.org blocks untouched when they have no <', () => {
    const data = faqJsonLd([{ question: '¿Qué es Fresco?', answer: 'Un planificador de menús.' }]);

    expect(serializeJsonLd(data)).toBe(JSON.stringify(data));
  });
});
