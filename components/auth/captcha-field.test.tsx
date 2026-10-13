import type { Captcha } from '@/components/auth/use-captcha';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { CaptchaField, statusMessage } from '@/components/auth/captcha-field';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';

/**
 * FRESCO-944 — the reserved Turnstile area on `/login`: it is there from the first render,
 * says where the check stands, and offers a retry when it ends without a token. The
 * Cloudflare script is replaced by a stub on `window.turnstile`, so nothing loads.
 */

interface RenderOptions {
  'callback': (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  'timeout-callback': () => void
  'before-interactive-callback': () => void
}

let lastOptions: RenderOptions | null = null;
const remove = mock(() => {});

function captchaOf(overrides: Partial<Captcha> = {}): Captcha {
  return {
    enabled: true,
    token: null,
    ready: false,
    status: 'verifying',
    resetKey: 0,
    setToken: mock(() => {}),
    setStatus: mock(() => {}),
    reset: mock(() => {}),
    ...overrides,
  };
}

beforeEach(() => {
  lastOptions = null;
  window.turnstile = {
    render: (_container, options) => {
      lastOptions = options;
      return 'widget-1';
    },
    remove,
  };
});

afterEach(() => {
  delete window.turnstile;
});

describe('statusMessage', () => {
  test('says what is happening for each state, and offers a retry only when the check cannot go on by itself', () => {
    expect(statusMessage('verifying', false)).toEqual({ text: 'Comprobando que eres una persona…', retry: false, isError: false });
    expect(statusMessage('verifying', true)).toMatchObject({ text: 'La verificación está tardando más de lo normal.', retry: true, isError: false });
    expect(statusMessage('passed', false)).toMatchObject({ text: 'Verificación completada.', retry: false });
    expect(statusMessage('failed', false)).toMatchObject({ text: 'No hemos podido verificarte. Inténtalo de nuevo.', retry: true, isError: true });
    expect(statusMessage('expired', false)).toMatchObject({ text: 'La verificación caducó. Vuelve a comprobarla.', retry: true, isError: true });
  });

  test('says nothing during a challenge: Cloudflare shows its own widget', () => {
    expect(statusMessage('challenge', false)).toBeNull();
  });
});

describe('CaptchaField with reserveSpace', () => {
  test('is there from the first render, 65px tall, before the widget says anything', () => {
    renderWithProviders(<CaptchaField captcha={captchaOf()} reserveSpace />);

    expect(screen.getByTestId('captcha_area').className).toContain('min-h-[65px]');
    expect(screen.getByTestId('captcha_status').textContent).toBe('Comprobando que eres una persona…');
    expect(screen.queryByTestId('captcha_retry_button')).toBeNull();
  });

  test('pins the widget container to 65px during a challenge so the area does not grow', () => {
    renderWithProviders(<CaptchaField captcha={captchaOf({ status: 'challenge' })} reserveSpace />);

    expect(screen.getByTestId('captcha_widget').className).toContain('h-[65px]');
    expect(screen.queryByTestId('captcha_status')).toBeNull();
  });

  test('shows the failure in words and a retry that resets the check', async () => {
    const captcha = captchaOf({ status: 'failed' });
    const user = setupUser();
    renderWithProviders(<CaptchaField captcha={captcha} reserveSpace />);

    expect(screen.getByTestId('captcha_status').textContent).toBe('No hemos podido verificarte. Inténtalo de nuevo.');
    await user.click(screen.getByTestId('captcha_retry_button'));

    expect(captcha.reset).toHaveBeenCalledTimes(1);
  });

  test('shows a retry when the check expired', () => {
    renderWithProviders(<CaptchaField captcha={captchaOf({ status: 'expired' })} reserveSpace />);

    expect(screen.getByTestId('captcha_status').textContent).toContain('caducó');
    expect(screen.getByTestId('captcha_retry_button')).toBeDefined();
  });

  test('tells the person it is taking long, with a retry, when the check stays undecided', async () => {
    const realSetTimeout = globalThis.setTimeout;
    // Run the 10 s "slow" timer immediately; every other timer keeps its real delay.
    globalThis.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
      realSetTimeout(handler, delay === 10_000 ? 0 : delay, ...args)) as typeof setTimeout;
    try {
      renderWithProviders(<CaptchaField captcha={captchaOf()} reserveSpace />);

      await waitFor(() => expect(screen.getByTestId('captcha_status').textContent).toBe('La verificación está tardando más de lo normal.'));
      expect(screen.getByTestId('captcha_retry_button')).toBeDefined();
    }
    finally {
      globalThis.setTimeout = realSetTimeout;
    }
  });
});

describe('CaptchaField reporting what the widget does', () => {
  test('a solved check hands over its token', async () => {
    const captcha = captchaOf();
    renderWithProviders(<CaptchaField captcha={captcha} reserveSpace />);
    await waitFor(() => expect(lastOptions).not.toBeNull());

    lastOptions!.callback('tok');

    expect(captcha.setToken).toHaveBeenCalledWith('tok');
  });

  test('an error clears the token and reports failed', async () => {
    const captcha = captchaOf();
    renderWithProviders(<CaptchaField captcha={captcha} reserveSpace />);
    await waitFor(() => expect(lastOptions).not.toBeNull());

    lastOptions!['error-callback']();

    expect(captcha.setToken).toHaveBeenCalledWith(null);
    expect(captcha.setStatus).toHaveBeenCalledWith('failed');
  });

  test.each(['expired-callback', 'timeout-callback'] as const)('%s clears the token and reports expired', async (callback) => {
    const captcha = captchaOf();
    renderWithProviders(<CaptchaField captcha={captcha} reserveSpace />);
    await waitFor(() => expect(lastOptions).not.toBeNull());

    lastOptions![callback]();

    expect(captcha.setToken).toHaveBeenCalledWith(null);
    expect(captcha.setStatus).toHaveBeenCalledWith('expired');
  });

  test('a challenge is reported so the widget can take its room', async () => {
    const captcha = captchaOf();
    renderWithProviders(<CaptchaField captcha={captcha} reserveSpace />);
    await waitFor(() => expect(lastOptions).not.toBeNull());

    lastOptions!['before-interactive-callback']();

    expect(captcha.setStatus).toHaveBeenCalledWith('challenge');
  });
});

describe('CaptchaField without reserveSpace (signup, onboarding, delete-account)', () => {
  test('keeps its old behavior: no reserved area, no status text', () => {
    renderWithProviders(<CaptchaField captcha={captchaOf()} />);

    expect(screen.queryByTestId('captcha_area')).toBeNull();
    expect(screen.queryByTestId('captcha_status')).toBeNull();
    expect(screen.getByTestId('captcha_widget').className).toBe('sr-only');
  });

  test('renders nothing when no site key is configured', () => {
    renderWithProviders(<CaptchaField captcha={captchaOf({ enabled: false, ready: true })} reserveSpace />);

    expect(screen.queryByTestId('captcha_widget')).toBeNull();
    expect(screen.queryByTestId('captcha_area')).toBeNull();
  });
});
