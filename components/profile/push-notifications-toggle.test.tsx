import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as pushApi from '@/lib/client-api/push';
import * as webPush from '@/lib/push/web-push-client';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { PushNotificationsToggle } from './push-notifications-toggle';

/**
 * FRESCO-779 (audit-6 A6-S2) — guest (anonymous) sessions cannot store a push
 * subscription, so the `/profile` switch is disabled for them with a reason
 * instead of failing on click. Registered users keep the existing behaviour
 * (here: this test browser has no Push API, so the "unsupported" copy).
 */

describe('PushNotificationsToggle', () => {
  test('a guest gets a disabled switch that explains an account is needed', () => {
    renderWithProviders(<PushNotificationsToggle isGuest />);

    expect(screen.getByTestId('push_notifications_switch')).toBeDisabled();
    expect(screen.getByTestId('push_notifications_description')).toHaveTextContent('Crea una cuenta');
  });

  test('a registered user is not shown the account message', () => {
    renderWithProviders(<PushNotificationsToggle />);

    expect(screen.getByTestId('push_notifications_description')).not.toHaveTextContent('Crea una cuenta');
  });
});

// FRESCO-1077 — the opt-in switch of a registered user. The browser Push API and
// the two client calls are the only boundaries replaced; the property pinned is
// that the switch reflects the real state and says why when it cannot flip.

describe('PushNotificationsToggle for a registered user', () => {
  let supportedSpy: ReturnType<typeof spyOn<typeof webPush, 'isPushSupported'>>;
  let currentSpy: ReturnType<typeof spyOn<typeof webPush, 'getCurrentPushSubscription'>>;
  let subscribeSpy: ReturnType<typeof spyOn<typeof pushApi, 'subscribeToPush'>>;
  let unsubscribeSpy: ReturnType<typeof spyOn<typeof pushApi, 'unsubscribeFromPush'>>;
  let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;
  const realNotification = Object.getOwnPropertyDescriptor(globalThis, 'Notification');

  function setPermission(permission: NotificationPermission) {
    Object.defineProperty(globalThis, 'Notification', { configurable: true, value: { permission } });
  }

  beforeEach(() => {
    setPermission('default');
    supportedSpy = spyOn(webPush, 'isPushSupported').mockReturnValue(true);
    currentSpy = spyOn(webPush, 'getCurrentPushSubscription').mockResolvedValue(null);
    subscribeSpy = spyOn(pushApi, 'subscribeToPush').mockResolvedValue(undefined as never);
    unsubscribeSpy = spyOn(pushApi, 'unsubscribeFromPush').mockResolvedValue(undefined);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const spy of [supportedSpy, currentSpy, subscribeSpy, unsubscribeSpy, errorSpy]) { spy.mockRestore(); }
    if (realNotification) { Object.defineProperty(globalThis, 'Notification', realNotification); }
    else { Reflect.deleteProperty(globalThis, 'Notification'); }
  });

  const description = () => screen.getByTestId('push_notifications_description');
  const toggle = () => screen.getByTestId('push_notifications_switch');
  // Native assertions inside waitFor: a failing jest-dom matcher can crash while it formats its message
  // under bun, which hangs the test until the 5 s timeout instead of reporting the real difference.
  const checked = () => toggle().getAttribute('aria-checked');
  const isDisabled = () => (toggle() as HTMLButtonElement).disabled;

  test('a browser without push support gets a disabled switch that says so', async () => {
    supportedSpy.mockReturnValue(false);
    renderWithProviders(<PushNotificationsToggle />);
    await waitFor(() => expect(description()).toHaveTextContent('no admite notificaciones push'));
    expect(toggle()).toBeDisabled();
  });

  test('a permission already blocked in the browser disables the switch and points to the settings', async () => {
    setPermission('denied');
    renderWithProviders(<PushNotificationsToggle />);
    await waitFor(() => expect(description()).toHaveTextContent('Has bloqueado las notificaciones'));
    expect(toggle()).toBeDisabled();
    expect(currentSpy).not.toHaveBeenCalled();
  });

  test('without a subscription the switch is off and can be turned on', async () => {
    renderWithProviders(<PushNotificationsToggle />);
    await waitFor(() => expect(isDisabled()).toBe(false));
    await waitFor(() => expect(checked()).toBe('false'));
  });

  test('with a subscription the switch is on', async () => {
    currentSpy.mockResolvedValue({} as PushSubscription);
    renderWithProviders(<PushNotificationsToggle />);
    await waitFor(() => expect(checked()).toBe('true'));
  });

  test('turning it on subscribes and the switch reads on', async () => {
    renderWithProviders(<PushNotificationsToggle />);
    await waitFor(() => expect(isDisabled()).toBe(false));
    await setupUser().click(toggle());
    await waitFor(() => expect(checked()).toBe('true'));
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
  });

  test('turning it off unsubscribes and the switch reads off', async () => {
    currentSpy.mockResolvedValue({} as PushSubscription);
    renderWithProviders(<PushNotificationsToggle />);
    await waitFor(() => expect(checked()).toBe('true'));
    await setupUser().click(toggle());
    await waitFor(() => expect(checked()).toBe('false'));
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  test('denying the native prompt on this click blocks the switch', async () => {
    subscribeSpy.mockRejectedValue(new webPush.WebPushError('No has dado permiso para recibir notificaciones.'));
    renderWithProviders(<PushNotificationsToggle />);
    await waitFor(() => expect(isDisabled()).toBe(false));
    await setupUser().click(toggle());
    await waitFor(() => expect(description()).toHaveTextContent('Has bloqueado las notificaciones'));
    expect(screen.queryByTestId('push_notifications_error_message')).toBeNull();
  });

  test('any other failure shows its message and leaves the switch usable', async () => {
    subscribeSpy.mockRejectedValue(new Error('La suscripción falló'));
    renderWithProviders(<PushNotificationsToggle />);
    await waitFor(() => expect(isDisabled()).toBe(false));
    await setupUser().click(toggle());
    expect(await screen.findByTestId('push_notifications_error_message')).toHaveTextContent('La suscripción falló');
    await waitFor(() => expect(isDisabled()).toBe(false));
  });
});
