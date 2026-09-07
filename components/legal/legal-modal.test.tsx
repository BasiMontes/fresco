import { describe, expect, test } from 'bun:test';
import { LegalModal } from '@/components/legal/legal-modal';
import { renderWithProviders, screen } from '@/tests/component-render';

/**
 * FRESCO-428 — only the new `'cookies'` section is covered here; the
 * pre-existing `terminos`/`privacidad`/`contacto` sections had no test file
 * before this story and are out of scope.
 */
describe('LegalModal — cookies section', () => {
  test('renders the cookie table with name/provider/purpose/duration/type columns', () => {
    renderWithProviders(<LegalModal open onOpenChange={() => {}} section="cookies" />);

    const table = screen.getByTestId('cookie_policy_table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText('fresco_cookie_consent')).toBeInTheDocument();
    expect(screen.getByText('sb-<ref>-auth-token')).toBeInTheDocument();
    expect(screen.getByText('ph_<clave>_posthog')).toBeInTheDocument();
  });

  test('marks the Supabase session cookie as Técnica and PostHog as Analítica', () => {
    renderWithProviders(<LegalModal open onOpenChange={() => {}} section="cookies" />);

    const rows = screen.getAllByRole('row');
    const supabaseRow = rows.find(row => row.textContent?.includes('Supabase'));
    const posthogRow = rows.find(row => row.textContent?.includes('PostHog'));

    expect(supabaseRow?.textContent).toContain('Técnica');
    expect(posthogRow?.textContent).toContain('Analítica');
  });
});
