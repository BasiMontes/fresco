import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, waitFor } from '@/tests/component-render';
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
