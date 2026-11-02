import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as sidebarPreference from '@/lib/layout/sidebar-preference';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { navState } from '@/tests/mocks/next-navigation';

// FRESCO-1077 — the desktop sidebar: which entry is current, the collapse toggle
// and its saved preference, the forced icon rail on narrow screens, and the
// account block only for a signed-in user. Only the cookie write, the viewport
// query and the Supabase client (behind the account menu) are replaced.

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: async () => ({ error: null }) } }),
}));

const { Sidebar } = await import('./sidebar');

let writeSpy: ReturnType<typeof spyOn<typeof sidebarPreference, 'writeSidebarCollapsed'>>;
let narrow = false;
const realMatchMedia = window.matchMedia.bind(window);

beforeEach(() => {
  narrow = false;
  navState.pathname = '/menu';
  writeSpy = spyOn(sidebarPreference, 'writeSidebarCollapsed').mockImplementation(() => {});
  window.matchMedia = ((query: string) => ({
    matches: narrow,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  writeSpy.mockRestore();
  window.matchMedia = realMatchMedia;
  navState.pathname = '/';
});

const toggle = () => screen.getByTestId('sidebar_collapse_toggle');

describe('Sidebar navigation', () => {
  test('lists the four sections and marks only the current one', () => {
    navState.pathname = '/calendar/semana';
    renderWithProviders(<Sidebar user={null} />);
    expect(screen.getAllByRole('link').map(l => l.getAttribute('href'))).toEqual(['/menu', '/menu', '/calendar', '/recipes', '/shopping-list']);
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Menú' })).not.toHaveAttribute('aria-current');
  });

  test('expanded, it shows the labels and the full logo', () => {
    renderWithProviders(<Sidebar user={null} />);
    expect(screen.getByText('Recetas')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fresco' }).getAttribute('src')).toContain('logo-negativo');
  });
});

describe('Sidebar collapse', () => {
  test('starts as the icon rail when the saved preference says so', () => {
    renderWithProviders(<Sidebar user={null} initialCollapsed />);
    expect(toggle()).toHaveAttribute('aria-label', 'Expandir menú');
    expect(screen.queryByText('Recetas')).toBeNull();
    expect(screen.getByRole('link', { name: 'Recetas' })).toHaveAttribute('title', 'Recetas');
    expect(screen.getByRole('img', { name: 'Fresco' }).getAttribute('src')).toContain('logo-mark-negativo');
  });

  test('the toggle collapses the rail and saves the choice', async () => {
    renderWithProviders(<Sidebar user={null} />);
    await setupUser().click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Recetas')).toBeNull();
    expect(writeSpy).toHaveBeenCalledWith(true);
  });

  test('the toggle expands a collapsed rail and saves that too', async () => {
    renderWithProviders(<Sidebar user={null} initialCollapsed />);
    await setupUser().click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Recetas')).toBeInTheDocument();
    expect(writeSpy).toHaveBeenCalledWith(false);
  });

  test('on a narrow screen it is always the icon rail, whatever was saved', () => {
    narrow = true;
    renderWithProviders(<Sidebar user={null} initialCollapsed={false} />);
    expect(screen.queryByText('Recetas')).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe('Sidebar account', () => {
  test('a signed-in user gets the account block', () => {
    renderWithProviders(<Sidebar user={{ nombre: 'Laura', email: 'laura@fresco.app', plan: 'free', isAnonymous: false }} />);
    expect(screen.getByTestId('sidebar_account_trigger')).toBeInTheDocument();
  });

  test('without a session the account block is not mounted', () => {
    renderWithProviders(<Sidebar user={null} />);
    expect(screen.queryByTestId('sidebar_account_trigger')).toBeNull();
  });
});
