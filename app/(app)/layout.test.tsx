import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { redirect } from 'next/navigation';
import * as userProfileApi from '@/lib/api/user-profile';
import * as consentStatus from '@/lib/legal/consent-status';
import { renderWithProviders, screen } from '@/tests/component-render';
import { headersState } from '@/tests/mocks/next-headers';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — the layout every signed-in route passes through. A visitor with no session goes to
// login (remembering where they were going), a user who never finished onboarding goes to
// onboarding, and everyone else gets the shell. A failing read degrades the shell, never breaks it.

let user: { id: string, email?: string, is_anonymous?: boolean } | null;
void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }),
}));

const { default: AppGroupLayout } = await import('./layout');

const redirectMock = redirect as unknown as ReturnType<typeof mock>;
const realMatchMedia = window.matchMedia.bind(window);

let nombreSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getUserNombre'>>;
let planSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getUserPlan'>>;
let profileSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'hasUserProfile'>>;
let consentsSpy: ReturnType<typeof spyOn<typeof consentStatus, 'getMissingConsents'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  user = { id: 'user-1', email: 'laura@fresco.app' };
  headersState.cookies = {};
  headersState.headers = {};
  redirectMock.mockClear();
  redirectMock.mockImplementation((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); });
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  nombreSpy = spyOn(userProfileApi, 'getUserNombre').mockResolvedValue('Laura');
  planSpy = spyOn(userProfileApi, 'getUserPlan').mockResolvedValue('free');
  profileSpy = spyOn(userProfileApi, 'hasUserProfile').mockResolvedValue(true);
  consentsSpy = spyOn(consentStatus, 'getMissingConsents').mockResolvedValue([]);
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  redirectMock.mockImplementation(() => {});
  window.matchMedia = realMatchMedia;
  for (const spy of [nombreSpy, planSpy, profileSpy, consentsSpy, errorSpy]) { spy.mockRestore(); }
});

const layout = async () => AppGroupLayout({ children: <p data-testid="page_child">contenido</p> });
const renderLayout = async () => { renderWithProviders(await layout()); };

describe('AppGroupLayout access', () => {
  test('a visitor with no session goes to login', async () => {
    user = null;
    await expect(layout()).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  test('and login remembers the page they were going to', async () => {
    user = null;
    headersState.headers = { 'x-pathname': '/recipes' };
    await expect(layout()).rejects.toThrow(`NEXT_REDIRECT:/login?next=${encodeURIComponent('/recipes')}`);
  });

  test('a user who never finished onboarding is sent to onboarding', async () => {
    profileSpy.mockResolvedValue(false);
    await expect(layout()).rejects.toThrow('NEXT_REDIRECT:/onboarding');
  });

  test('a failing profile check assumes the user is onboarded instead of bouncing everyone', async () => {
    profileSpy.mockRejectedValue(new Error('db down'));
    await renderLayout();
    expect(screen.getByTestId('page_child')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('AppGroupLayout shell', () => {
  test('wraps the page in the shell and reads the account once for the user', async () => {
    await renderLayout();
    expect(screen.getByTestId('page_child')).toBeInTheDocument();
    expect(nombreSpy).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(planSpy).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  test('a failing name and plan read degrade the shell instead of breaking it', async () => {
    nombreSpy.mockRejectedValue(new Error('x'));
    planSpy.mockRejectedValue(new Error('y'));
    await renderLayout();
    expect(screen.getByTestId('page_child')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  test('a saved collapsed sidebar is honoured from the first render', async () => {
    headersState.cookies = { sidebar_collapsed: '1' };
    await renderLayout();
    expect(screen.getByTestId('sidebar_collapse_toggle')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('AppGroupLayout consents', () => {
  test('nothing blocks the screen when the consents are up to date', async () => {
    await renderLayout();
    expect(screen.queryByTestId('reconsent_dialog')).toBeNull();
  });

  test('a registered user who has not accepted the current terms is asked again', async () => {
    consentsSpy.mockResolvedValue(['terms'] as never);
    await renderLayout();
    expect(await screen.findByTestId('reconsent_dialog')).toBeInTheDocument();
  });

  test('a guest is never asked: the consents are given when an account is created', async () => {
    user = { id: 'guest-1', is_anonymous: true };
    consentsSpy.mockResolvedValue(['terms'] as never);
    await renderLayout();
    expect(consentsSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reconsent_dialog')).toBeNull();
  });

  test('a failing consent read fails open: nobody is locked out', async () => {
    consentsSpy.mockRejectedValue(new Error('db down'));
    await renderLayout();
    expect(screen.getByTestId('page_child')).toBeInTheDocument();
    expect(screen.queryByTestId('reconsent_dialog')).toBeNull();
  });
});
