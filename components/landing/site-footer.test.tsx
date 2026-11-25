import { describe, expect, test } from 'bun:test';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import { renderWithProviders, screen } from '@/tests/component-render';
import { SiteFooter } from './site-footer';
import '@/tests/mocks/next-navigation';

// The copyright line computes the year, so it never goes stale (it once said 2025 in 2026).
describe('SiteFooter', () => {
  test('the copyright line shows the current year', () => {
    renderWithProviders(<CookieConsentProvider initialDecision="rejected"><SiteFooter /></CookieConsentProvider>);

    const line = screen.getByRole('contentinfo').querySelector('p');
    expect(line?.textContent).toContain(`© ${new Date().getFullYear()} Fresco`);
  });
});
