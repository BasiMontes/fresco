import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as identityCookie from '@/lib/auth/identity-cookie';
import * as identity from '@/lib/client-api/identity';
import * as posthogEvents from '@/lib/posthog/events';
import { act, renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { SiteNav } from './site-nav';

describe('SiteNav', () => {
  let hasCookie: ReturnType<typeof spyOn>;
  let getSession: ReturnType<typeof spyOn>;

  beforeEach(() => {
    hasCookie = spyOn(identity, 'hasSupabaseSessionCookie').mockReturnValue(false);
    getSession = spyOn(identity, 'getSessionLazy').mockResolvedValue(null);
    identityCookie.clearNombreCookie();
  });

  afterEach(() => {
    hasCookie.mockRestore();
    getSession.mockRestore();
    spyOn(posthogEvents, 'captureEvent').mockRestore();
    identityCookie.clearNombreCookie();
  });

  describe('guest', () => {
    test('shows login and sign-up calls to action without checking the session', () => {
      renderWithProviders(<SiteNav />);

      expect(screen.getByRole('link', { name: 'Ya tengo cuenta' })).toHaveAttribute('href', '/login');
      expect(screen.getByRole('link', { name: 'Empezar gratis' })).toHaveAttribute('href', '/onboarding');
      expect(screen.queryByTestId('site_nav_authed')).not.toBeInTheDocument();
      expect(getSession).not.toHaveBeenCalled();
    });

    test('the sign-up call to action reports the site_nav location', async () => {
      const capture = spyOn(posthogEvents, 'captureEvent').mockImplementation(() => {});
      renderWithProviders(<SiteNav />);

      await setupUser().click(screen.getByRole('link', { name: 'Empezar gratis' }));

      expect(capture).toHaveBeenCalledWith('landing_cta_clicked', { location: 'site_nav' });
    });

    test('links to the landing sections and the home page', () => {
      renderWithProviders(<SiteNav />);

      expect(screen.getByRole('link', { name: '¿Cómo funciona?' })).toHaveAttribute('href', '#como-funciona');
      expect(screen.getByRole('link', { name: 'Precios' })).toHaveAttribute('href', '#pricing');
      expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq');
      expect(screen.getByRole('link', { name: /Fresco/ })).toHaveAttribute('href', '/');
    });

    test('a visitor whose cookie holds no live session stays on the guest nav', async () => {
      hasCookie.mockReturnValue(true);
      renderWithProviders(<SiteNav />);

      await waitFor(() => expect(getSession).toHaveBeenCalled());
      expect(screen.getByRole('link', { name: 'Empezar gratis' })).toBeInTheDocument();
      expect(screen.queryByTestId('site_nav_authed')).not.toBeInTheDocument();
    });
  });

  describe('signed-in visitor', () => {
    beforeEach(() => {
      hasCookie.mockReturnValue(true);
      getSession.mockResolvedValue({ user: { id: 'u1' } });
    });

    test('swaps the guest calls to action for a link to the app', async () => {
      renderWithProviders(<SiteNav />);

      const appLink = await screen.findByTestId('site_nav_app_link');
      expect(appLink).toHaveAttribute('href', '/menu');
      expect(appLink).toHaveTextContent('Ir a mi menú');
      expect(screen.queryByRole('link', { name: 'Empezar gratis' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Ya tengo cuenta' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('site_nav_greeting')).not.toBeInTheDocument();
    });

    test('greets the user by the name kept in the identity cookie', async () => {
      identityCookie.writeNombreCookie('Laura');
      renderWithProviders(<SiteNav />);

      expect(await screen.findByTestId('site_nav_greeting')).toHaveTextContent('Hola, Laura');
    });

    test('picks up the name when the cookie is written after the first paint', async () => {
      renderWithProviders(<SiteNav />);
      await screen.findByTestId('site_nav_authed');
      expect(screen.queryByTestId('site_nav_greeting')).not.toBeInTheDocument();

      act(() => { identityCookie.writeNombreCookie('Marta'); });

      expect(await screen.findByTestId('site_nav_greeting')).toHaveTextContent('Hola, Marta');
    });

    test('the mobile sheet mirrors the signed-in state and closes on navigation', async () => {
      identityCookie.writeNombreCookie('Laura');
      const user = setupUser();
      renderWithProviders(<SiteNav />);
      await screen.findByTestId('site_nav_authed');

      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

      expect(screen.getByTestId('site_nav_greeting_mobile')).toHaveTextContent('Hola, Laura');
      expect(screen.queryByTestId('site_nav_login_mobile')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('site_nav_app_link_mobile'));
      expect(screen.queryByTestId('site_nav_authed_mobile')).not.toBeInTheDocument();
    });

    test('the mobile sheet omits the greeting when no name is known', async () => {
      const user = setupUser();
      renderWithProviders(<SiteNav />);
      await screen.findByTestId('site_nav_authed');

      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

      expect(screen.getByTestId('site_nav_authed_mobile')).toBeInTheDocument();
      expect(screen.queryByTestId('site_nav_greeting_mobile')).not.toBeInTheDocument();
    });

    test('does not update after unmounting before the session resolves', async () => {
      let resolve: (value: Awaited<ReturnType<typeof identity.getSessionLazy>>) => void = () => {};
      getSession.mockImplementation(async () => new Promise((r) => { resolve = r; }));
      const { unmount } = renderWithProviders(<SiteNav />);

      unmount();
      await act(async () => { resolve({ user: { id: 'u1' } } as Awaited<ReturnType<typeof identity.getSessionLazy>>); });

      expect(screen.queryByTestId('site_nav_authed')).not.toBeInTheDocument();
    });
  });

  describe('mobile menu', () => {
    test('the hamburger opens and closes the sheet, updating its label', async () => {
      const user = setupUser();
      renderWithProviders(<SiteNav />);

      const toggle = screen.getByRole('button', { name: 'Abrir menú' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('site_nav_login_mobile')).not.toBeInTheDocument();

      await user.click(toggle);

      expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('site_nav_login_mobile')).toHaveAttribute('href', '/login');
      expect(screen.getByText('Tema')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cerrar menú' }));

      expect(screen.queryByTestId('site_nav_login_mobile')).not.toBeInTheDocument();
    });

    test('choosing a section link closes the sheet', async () => {
      const user = setupUser();
      renderWithProviders(<SiteNav />);
      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

      const links = screen.getAllByRole('link', { name: 'Precios' });
      expect(links).toHaveLength(2);
      await user.click(links[1]);

      expect(screen.queryByTestId('site_nav_login_mobile')).not.toBeInTheDocument();
    });

    test('the login link in the sheet closes it', async () => {
      const user = setupUser();
      renderWithProviders(<SiteNav />);
      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

      await user.click(screen.getByTestId('site_nav_login_mobile'));

      expect(screen.queryByTestId('site_nav_login_mobile')).not.toBeInTheDocument();
    });

    test('clicking the backdrop closes the sheet', async () => {
      const user = setupUser();
      const { container } = renderWithProviders(<SiteNav />);
      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

      const scrim = container.querySelector('[aria-hidden="true"].fixed');
      expect(scrim).not.toBeNull();
      await user.click(scrim as Element);

      expect(screen.queryByTestId('site_nav_login_mobile')).not.toBeInTheDocument();
    });
  });
});
