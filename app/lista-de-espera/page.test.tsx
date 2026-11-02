import { describe, expect, test } from 'bun:test';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import { renderWithProviders, screen } from '@/tests/component-render';
import WaitlistPage, { metadata } from './page';
import '@/tests/mocks/next-navigation';

// FRESCO-1008 — the page the waitlist email links open. The token is 43 URL-safe characters; anything
// else is shown as an invalid link without touching the database. The action is a button, never done on
// load, so a mail scanner that fetches the link changes nothing.

const TOKEN = 'a'.repeat(43);

const renderPage = async (searchParams: { token?: string, accion?: string }) => {
  renderWithProviders(<CookieConsentProvider initialDecision="rejected">{await WaitlistPage({ searchParams: Promise.resolve(searchParams) })}</CookieConsentProvider>);
};

describe('WaitlistPage', () => {
  test('is kept out of search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  test('a valid token offers to confirm, behind a button', async () => {
    await renderPage({ token: TOKEN });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lista de espera');
    expect(screen.getByTestId('waitlist_confirm_button')).toBeEnabled();
    expect(screen.queryByTestId('waitlist_link_invalid')).toBeNull();
  });

  test('confirming is the default action, and says so on the button', async () => {
    await renderPage({ token: TOKEN });
    expect(screen.getByTestId('waitlist_confirm_button')).toHaveTextContent('Confirmar mi correo');
  });

  test('accion=baja offers to leave the list instead', async () => {
    await renderPage({ token: TOKEN, accion: 'baja' });
    expect(screen.getByTestId('waitlist_confirm_button')).toHaveTextContent('Borrar mi correo');
  });

  test('a missing token is an invalid link', async () => {
    await renderPage({});
    expect(screen.getByTestId('waitlist_link_invalid')).toHaveTextContent('Este enlace no es válido');
    expect(screen.queryByTestId('waitlist_confirm_button')).toBeNull();
  });

  test('a malformed token is an invalid link', async () => {
    await renderPage({ token: 'corto' });
    expect(screen.getByTestId('waitlist_link_invalid')).toBeInTheDocument();
  });
});
