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
