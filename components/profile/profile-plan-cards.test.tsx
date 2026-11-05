import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { ProfilePlanCards } from './profile-plan-cards';
import '@/tests/mocks/next-navigation';

// FRESCO-1078 — exactly one of the Free upsell and the Pro subscription card shows, and the
// payment-failed notice only ever appears next to the Pro card.

const props = { plan: 'free' as const, paymentFailedAt: null, trialAvailable: true, prices: null };

describe('ProfilePlanCards', () => {
  test('a Free user sees the upsell and nothing of the subscription', () => {
    renderWithProviders(<ProfilePlanCards {...props} />);
    expect(screen.getByTestId('pro_upsell_card')).toBeInTheDocument();
    expect(screen.queryByTestId('manage_subscription_button')).toBeNull();
    expect(screen.queryByTestId('payment_failed_notice')).toBeNull();
  });

  test('a Pro user sees the subscription card with the manage button and no upsell', () => {
    renderWithProviders(<ProfilePlanCards {...props} plan="pro" />);
    expect(screen.getByText('Tu suscripción')).toBeInTheDocument();
    expect(screen.getByTestId('manage_subscription_button')).toBeInTheDocument();
    expect(screen.queryByTestId('pro_upsell_card')).toBeNull();
  });

  test('a Pro user whose payment failed also sees the notice', () => {
    renderWithProviders(<ProfilePlanCards {...props} plan="pro" paymentFailedAt="2026-11-01T10:00:00.000Z" />);
    expect(screen.getByTestId('payment_failed_notice')).toHaveTextContent('Tu último pago falló');
    expect(screen.getByTestId('manage_subscription_button')).toBeInTheDocument();
  });

  test('a Free user never sees the payment notice, even with a failed date on record', () => {
    renderWithProviders(<ProfilePlanCards {...props} paymentFailedAt="2026-11-01T10:00:00.000Z" />);
    expect(screen.queryByTestId('payment_failed_notice')).toBeNull();
  });

  // FRESCO-1122 (A8-PAY-05)
  test('a Free user back from a paid checkout sees the activating notice instead of the upsell', () => {
    renderWithProviders(<ProfilePlanCards {...props} checkoutSuccess />);
    expect(screen.getByTestId('plan_activating_notice')).toBeInTheDocument();
    expect(screen.queryByTestId('pro_upsell_card')).toBeNull();
  });

  test('once the plan is Pro the activating notice is gone', () => {
    renderWithProviders(<ProfilePlanCards {...props} plan="pro" checkoutSuccess />);
    expect(screen.queryByTestId('plan_activating_notice')).toBeNull();
    expect(screen.getByTestId('manage_subscription_button')).toBeInTheDocument();
  });

  test('a Free user without the checkout flag sees no activating notice', () => {
    renderWithProviders(<ProfilePlanCards {...props} />);
    expect(screen.queryByTestId('plan_activating_notice')).toBeNull();
  });
});
