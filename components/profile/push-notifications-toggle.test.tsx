import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
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
