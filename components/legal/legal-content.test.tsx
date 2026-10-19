import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { CookiesContent, PrivacyContent, TermsContent } from './legal-content';

/**
 * FRESCO-1013 (A7-UI-02, A7-UI-03) — the legal pages follow the heading order of the page they sit in, and the
 * cookie table, which scrolls inside its box on a phone, can take keyboard focus.
 */
describe('legal content headings', () => {
  test('on a /legal page (the title is an h1) the sections are h2, never h3', () => {
    const { container } = renderWithProviders(<PrivacyContent headingLevel="h2" />);

    expect(container.querySelectorAll('h2').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('h3')).toHaveLength(0);
  });

  test('inside the modal (the dialog title is an h2) the default stays h3', () => {
    const { container } = renderWithProviders(<TermsContent />);

    expect(container.querySelectorAll('h3').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('h2')).toHaveLength(0);
  });
});

describe('cookie table region', () => {
  test('is a named, focusable region so a keyboard user can scroll the columns that are off-screen', () => {
    renderWithProviders(<CookiesContent />);

    const region = screen.getByRole('region', { name: 'Tabla de cookies' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region.className).toContain('overflow-x-auto');
    expect(region.querySelector('table')).not.toBeNull();
  });

  test('declares the Sentry item next to the others (FRESCO-1008)', () => {
    renderWithProviders(<CookiesContent />);

    expect(screen.getByText(/sentry_previous_trace/)).toBeInTheDocument();
  });
});
