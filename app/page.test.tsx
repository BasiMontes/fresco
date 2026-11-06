import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import * as proPrices from '@/lib/billing/pro-prices';
import { renderWithProviders, screen } from '@/tests/component-render';
import GuestLandingPage, { revalidate } from './page';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — the guest landing ("/"). Pinned: it reads the Pro prices from Stripe and re-renders
// at most hourly, it emits the structured data, and its landmarks are header / main / footer with
// the content sections inside <main id="main"> (the target of the skip link).

let pricesSpy: ReturnType<typeof spyOn<typeof proPrices, 'getProPrices'>>;

beforeEach(() => { pricesSpy = spyOn(proPrices, 'getProPrices').mockResolvedValue(null); });
afterEach(() => { pricesSpy.mockRestore(); });

const renderPage = async () => {
  const view = renderWithProviders(<CookieConsentProvider initialDecision="rejected">{await GuestLandingPage()}</CookieConsentProvider>);
  return view;
};

describe('GuestLandingPage', () => {
  test('re-renders at most hourly so a price change in Stripe reaches the page without a deploy', () => {
    expect(revalidate).toBe(3600);
  });

  test('reads the Pro prices once', async () => {
    await renderPage();
    expect(pricesSpy).toHaveBeenCalledTimes(1);
  });

  test('has the header, the main landmark the skip link points at, and the footer', async () => {
    await renderPage();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(document.querySelector('main#main')).not.toBeNull();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  // FRESCO-1134 (Anti Web Slop): the order is see it, how it works, why, what Pro adds, price, questions.
  // The usual hero, problem, three features, pricing order is one of the template signals it counts.
  test('follows the FRESCO-1134 section order and no longer has the impact-stats section', async () => {
    await renderPage();

    const headings = [...document.querySelectorAll('main h2')].map(h => h.textContent);
    expect(headings).toEqual([
      'Un domingo sin agobios.',
      '¿Cuántas veces has acabado comiendo lo que sea?',
      'Aprende de lo que cocinas.',
      'Sin letra pequeña. Sin trampa.',
      'Preguntas frecuentes',
      'El próximo domingo sin agobios.',
    ]);
    expect(document.body.textContent).not.toContain('Lo que Fresco hace por ti');
  });

  test('puts the brand video right after the hero, before the walkthrough', async () => {
    await renderPage();

    const video = document.querySelector('video');
    const walkthrough = document.querySelector('#como-funciona');
    expect(video).not.toBeNull();
    expect(walkthrough).not.toBeNull();
    expect(video!.compareDocumentPosition(walkthrough!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('has no arrow at the end of the call to action labels', async () => {
    await renderPage();

    expect(document.querySelector('main')!.textContent).not.toContain('→');
  });

  test('emits the software application and FAQ structured data', async () => {
    const { container } = await renderPage();
    const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent ?? '{}')['@type']);
    expect(blocks).toContain('SoftwareApplication');
    expect(blocks).toContain('FAQPage');
  });

  test('shows the real Pro prices when Stripe answers', async () => {
    pricesSpy.mockResolvedValue({ month: 7.99, year: 69, taxIncluded: true });
    await renderPage();
    expect(document.body.textContent).toContain('7,99');
  });

  test('keeps working, without prices, when Stripe could not be read', async () => {
    await renderPage();
    expect(document.querySelector('main#main')).not.toBeNull();
    expect(document.body.textContent).not.toContain('7,99');
  });
});
