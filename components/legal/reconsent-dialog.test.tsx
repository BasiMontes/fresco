import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';

/**
 * FRESCO-1007 — the blocking re-consent dialog: it cannot be dismissed, accepting needs the age
 * and the terms checkboxes, it posts the registration set and refreshes the server tree, and the
 * only other way out is signing out.
 */

const signOutMock = mock(async () => ({ error: null }));

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: signOutMock } }),
}));

const { ReconsentDialog } = await import('./reconsent-dialog');

let fetchSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  routerMock.refresh.mockClear();
  routerMock.push.mockClear();
  signOutMock.mockClear();
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
});

async function tickBoxes(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByTestId('confirm_age_checkbox'));
  await user.click(screen.getByTestId('accept_terms_checkbox'));
}

describe('ReconsentDialog', () => {
  test('has no close button and ignores Escape', async () => {
    const user = setupUser();
    renderWithProviders(<ReconsentDialog />);

    expect(screen.queryByTestId('reconsent_dialog_close_button')).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('reconsent_dialog')).toBeDefined();
  });

  test('the accept button stays disabled until both boxes are ticked', async () => {
    const user = setupUser();
    renderWithProviders(<ReconsentDialog />);
    const accept = screen.getByTestId<HTMLButtonElement>('reconsent_accept_button');

    expect(accept.disabled).toBe(true);
    await user.click(screen.getByTestId('confirm_age_checkbox'));
    expect(accept.disabled).toBe(true);
    await user.click(screen.getByTestId('accept_terms_checkbox'));
    expect(accept.disabled).toBe(false);
  });

  test('accepting posts the registration consents and refreshes the page', async () => {
    const user = setupUser();
    renderWithProviders(<ReconsentDialog />);
    await tickBoxes(user);
    await user.click(screen.getByTestId('reconsent_accept_button'));

    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/consents');
    expect(JSON.parse(init.body as string)).toEqual({ kinds: ['age_14', 'terms', 'privacy'] });
  });

  test('shows an error and does not refresh when the server rejects the write', async () => {
    fetchSpy.mockResolvedValue(new Response('{}', { status: 500 }));
    const user = setupUser();
    renderWithProviders(<ReconsentDialog />);
    await tickBoxes(user);
    await user.click(screen.getByTestId('reconsent_accept_button'));

    expect(await screen.findByTestId('reconsent_error_message')).toBeDefined();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  test('"Cerrar sesión" signs out and goes to /login without recording anything', async () => {
    const user = setupUser();
    renderWithProviders(<ReconsentDialog />);
    await user.click(screen.getByTestId('reconsent_logout_button'));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/login'));
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
