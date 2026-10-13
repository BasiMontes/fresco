import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { LegalLinks } from './legal-links';

/**
 * FRESCO-939 (audit UX-07) — the legal footer of the access screens used to be four
 * buttons that opened a modal: no URL to share, no new tab, nothing a crawler or a
 * "open in new tab" gesture could use. They are links to the real `/legal/*` routes now,
 * and open in a new tab so a half-filled login or signup form is not lost.
 */

const EXPECTED = [
  ['legal_links_terms', 'Términos', '/legal/terminos'],
  ['legal_links_privacy', 'Privacidad', '/legal/privacidad'],
  ['legal_links_contact', 'Contacto', '/legal/contacto'],
  ['legal_links_cookies', 'Cookies', '/legal/cookies'],
] as const;

describe('LegalLinks', () => {
  test.each(EXPECTED)('%s is a link to %s with its own URL', (testId, label, href) => {
    renderWithProviders(<LegalLinks />);

    const link = screen.getByTestId(testId);

    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe(href);
    expect(link.textContent).toContain(label);
  });

  test.each(EXPECTED)('%s opens in a new tab without handing the page its opener', (testId) => {
    renderWithProviders(<LegalLinks />);

    const link = screen.getByTestId(testId);

    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  test.each(EXPECTED)('%s tells a screen reader that it opens a new tab', (testId) => {
    renderWithProviders(<LegalLinks />);

    expect(screen.getByTestId(testId).textContent).toContain('se abre en una pestaña nueva');
  });

  test('no longer renders buttons or a modal', () => {
    renderWithProviders(<LegalLinks />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
