import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as pushApi from '@/lib/client-api/push';
import * as events from '@/lib/posthog/events';
import { WebPushError } from '@/lib/push/web-push-client';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/tests/component-render';
import { PushPromptBanner } from './push-prompt-banner';

/**
 * FRESCO-779 (audit-6 A6-S2) — guest (anonymous) sessions cannot store a push
 * subscription any more, so the post-first-menu nudge must not be offered to
 * them: it would end in an error on "Activar". A registered user keeps seeing
 * it (the control case, so the guest assertion is not vacuous).
 */

const FIRST_MENU_KEY = 'fresco-first-menu-generated';

type WindowWithPush = Window & { PushManager?: unknown, Notification?: { permission: string } };

const originals: { serviceWorker?: PropertyDescriptor, PushManager?: unknown, Notification?: unknown } = {};

beforeEach(() => {
  // `isPushSupported()` = serviceWorker in navigator && PushManager in window.
  originals.serviceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  originals.PushManager = (window as WindowWithPush).PushManager;
  originals.Notification = (globalThis as { Notification?: unknown }).Notification;
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
  (window as WindowWithPush).PushManager = function PushManager() {};
  (globalThis as { Notification?: unknown }).Notification = { permission: 'default' };
  window.sessionStorage.setItem(FIRST_MENU_KEY, '1');
});

afterEach(() => {
  if (originals.serviceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', originals.serviceWorker);
  }
  else {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  }
  (window as WindowWithPush).PushManager = originals.PushManager;
  (globalThis as { Notification?: unknown }).Notification = originals.Notification;
  window.sessionStorage.removeItem(FIRST_MENU_KEY);
});

describe('PushPromptBanner', () => {
  test('a registered user sees the nudge right after the first menu', async () => {
    renderWithProviders(<PushPromptBanner />);
    await waitFor(() => expect(screen.getByTestId('push_prompt_banner')).toBeInTheDocument());
  });

  test('a guest never sees it', async () => {
    renderWithProviders(<PushPromptBanner isGuest />);
    // Give the mount effect a chance to run, then assert nothing rendered.
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(screen.queryByTestId('push_prompt_banner')).toBeNull();
  });
});

// FRESCO-372 — what the two buttons do. "Ahora no" just hides it; "Activar" subscribes, and a failure
// of any kind hides it too (the toggle in /profile stays as the second chance).
describe('PushPromptBanner actions', () => {
  let subscribeSpy: ReturnType<typeof spyOn<typeof pushApi, 'subscribeToPush'>>;
  let captureSpy: ReturnType<typeof spyOn<typeof events, 'captureEvent'>>;
  let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

  beforeEach(() => {
    subscribeSpy = spyOn(pushApi, 'subscribeToPush').mockResolvedValue(undefined as never);
    captureSpy = spyOn(events, 'captureEvent').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const spy of [subscribeSpy, captureSpy, errorSpy]) { spy.mockRestore(); }
  });

  async function showBanner() {
    renderWithProviders(<PushPromptBanner />);
    await waitFor(() => expect(screen.getByTestId('push_prompt_banner')).toBeInTheDocument());
  }

  test('showing it is recorded once', async () => {
    await showBanner();
    expect(captureSpy).toHaveBeenCalledWith(events.POSTHOG_EVENTS.PUSH_PROMPT_SHOWN);
  });

  test('"Ahora no" hides it and subscribes to nothing', async () => {
    await showBanner();
    fireEvent.click(screen.getByTestId('push_prompt_dismiss_button'));

    expect(screen.queryByTestId('push_prompt_banner')).toBeNull();
    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  test('"Activar" subscribes, records the grant and hides the banner', async () => {
    await showBanner();
    fireEvent.click(screen.getByTestId('push_prompt_activate_button'));

    await waitFor(() => expect(screen.queryByTestId('push_prompt_banner')).toBeNull());
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith(events.POSTHOG_EVENTS.PUSH_PERMISSION_GRANTED);
  });

  test('a native denial hides the banner quietly: no grant recorded, nothing logged', async () => {
    subscribeSpy.mockRejectedValue(new WebPushError('permission denied'));
    await showBanner();
    fireEvent.click(screen.getByTestId('push_prompt_activate_button'));

    await waitFor(() => expect(screen.queryByTestId('push_prompt_banner')).toBeNull());
    expect(captureSpy).not.toHaveBeenCalledWith(events.POSTHOG_EVENTS.PUSH_PERMISSION_GRANTED);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('any other failure hides the banner too, and is logged', async () => {
    subscribeSpy.mockRejectedValue(new Error('server down'));
    await showBanner();
    fireEvent.click(screen.getByTestId('push_prompt_activate_button'));

    await waitFor(() => expect(screen.queryByTestId('push_prompt_banner')).toBeNull());
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  test('it stays hidden when the browser already answered (permission is not "default")', async () => {
    (globalThis as { Notification?: unknown }).Notification = { permission: 'denied' };
    renderWithProviders(<PushPromptBanner />);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(screen.queryByTestId('push_prompt_banner')).toBeNull();
  });

  test('it stays hidden when no first menu was just generated', async () => {
    window.sessionStorage.removeItem(FIRST_MENU_KEY);
    renderWithProviders(<PushPromptBanner />);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(screen.queryByTestId('push_prompt_banner')).toBeNull();
  });
});
