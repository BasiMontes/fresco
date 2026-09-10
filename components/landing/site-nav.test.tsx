import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { SiteNav } from './site-nav';

/**
 * FRESCO-486 — the landing nav's default (no session) state. The shared
 * `@/lib/supabase/client` mock in `bun-test-setup.ts` resolves
 * `getSession()` to "no session", so this exercises the guest branch.
 * The logged-in branch is covered by `lib/auth/identity-cookie.test.ts`
 * (the name cookie) plus the story's live-UI validation pass with a real
 * signed-in user.
 */
describe('SiteNav — guest (no session)', () => {
  test('shows the guest CTAs and no app link', async () => {
    renderWithProviders(<SiteNav />);

    expect(await screen.findByRole('link', { name: 'Ya tengo cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Empezar gratis' })).toBeInTheDocument();
    expect(screen.queryByTestId('site_nav_app_link')).toBeNull();
    expect(screen.queryByTestId('site_nav_greeting')).toBeNull();
    expect(screen.queryByTestId('site_nav_authed')).toBeNull();
  });
});
