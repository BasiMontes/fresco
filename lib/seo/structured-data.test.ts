import { describe, expect, test } from 'bun:test';
import {
  faqJsonLd,
  organizationJsonLd,
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
  test('is a valid SoftwareApplication block with Free + Pro offers', () => {
    const data = softwareApplicationJsonLd();

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('SoftwareApplication');
    expect(typeof data.name).toBe('string');
    expect(typeof data.description).toBe('string');
    expect(typeof data.applicationCategory).toBe('string');
    expect(typeof data.operatingSystem).toBe('string');
    expect(data.offers).toHaveLength(2);
    data.offers.forEach((offer) => {
      expect(offer['@type']).toBe('Offer');
      expect(typeof offer.price).toBe('string');
      expect(offer.priceCurrency).toBe('EUR');
    });
  });

  test('has no aggregateRating — no real review data exists', () => {
    const data = softwareApplicationJsonLd();

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
