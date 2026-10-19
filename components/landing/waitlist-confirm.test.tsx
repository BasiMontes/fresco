import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { WaitlistConfirm } from './waitlist-confirm';

/** FRESCO-1008 — the button behind the waitlist email's links: nothing happens until it is pressed, and it posts the token with the action. */

const realFetch = globalThis.fetch;
let calls: Array<{ url: string, body: unknown }> = [];

function stubFetch(status: number) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return { ok: status >= 200 && status < 300, status } as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  calls = [];
});

describe('WaitlistConfirm', () => {
  test('doing nothing sends nothing: a scanner that only loads the page changes no data', () => {
    stubFetch(200);
    renderWithProviders(<WaitlistConfirm token="t" action="confirm" />);

    expect(calls).toHaveLength(0);
  });

  test('pressing the button posts the token and the action, then says it is done', async () => {
    stubFetch(200);
    const user = setupUser();
    renderWithProviders(<WaitlistConfirm token="tok" action="confirm" />);

    await user.click(screen.getByTestId('waitlist_confirm_button'));

    expect(await screen.findByTestId('waitlist_confirm_done')).toBeInTheDocument();
    expect(calls).toEqual([{ url: '/api/waitlist/confirm', body: { token: 'tok', action: 'confirm' } }]);
  });

  test('the removal link posts the remove action', async () => {
    stubFetch(200);
    const user = setupUser();
    renderWithProviders(<WaitlistConfirm token="tok" action="remove" />);

    await user.click(screen.getByTestId('waitlist_confirm_button'));

    expect(await screen.findByTestId('waitlist_confirm_done')).toHaveTextContent('borrado');
    expect(calls[0].body).toEqual({ token: 'tok', action: 'remove' });
  });

  test('a token nobody has says the link is no longer valid', async () => {
    stubFetch(404);
    const user = setupUser();
    renderWithProviders(<WaitlistConfirm token="tok" action="confirm" />);

    await user.click(screen.getByTestId('waitlist_confirm_button'));

    expect(await screen.findByTestId('waitlist_confirm_invalid')).toBeInTheDocument();
  });

  test('any other failure offers another try', async () => {
    stubFetch(500);
    const user = setupUser();
    renderWithProviders(<WaitlistConfirm token="tok" action="confirm" />);

    await user.click(screen.getByTestId('waitlist_confirm_button'));

    expect(await screen.findByTestId('waitlist_confirm_error')).toBeInTheDocument();
    expect(screen.getByTestId('waitlist_confirm_button')).toBeEnabled();
  });
});
