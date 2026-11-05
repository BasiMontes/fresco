import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { ACTIVATION_GIVE_UP_MS, ACTIVATION_POLL_MS, PlanActivatingNotice } from './plan-activating-notice';

// FRESCO-1122 (A8-PAY-05) — after Stripe Checkout the plan flips to Pro only when the webhook
// lands. Until then /profile says so and re-reads the server on an interval, then gives up politely.

beforeEach(() => {
  jest.useFakeTimers();
  routerMock.refresh.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PlanActivatingNotice', () => {
  test('tells the user the plan is being activated', () => {
    renderWithProviders(<PlanActivatingNotice />);
    const notice = screen.getByTestId('plan_activating_notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveTextContent('Activando tu plan Pro');
  });

  test('re-reads the server every poll interval', () => {
    renderWithProviders(<PlanActivatingNotice />);
    expect(routerMock.refresh).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(ACTIVATION_POLL_MS); });
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(ACTIVATION_POLL_MS); });
    expect(routerMock.refresh).toHaveBeenCalledTimes(2);
  });

  test('stops polling and shows the delay message after giving up', () => {
    renderWithProviders(<PlanActivatingNotice />);
    act(() => { jest.advanceTimersByTime(ACTIVATION_GIVE_UP_MS); });
    const calls = routerMock.refresh.mock.calls.length;
    expect(screen.getByTestId('plan_activating_notice')).toHaveTextContent('está tardando más de lo normal');
    act(() => { jest.advanceTimersByTime(ACTIVATION_POLL_MS * 5); });
    expect(routerMock.refresh).toHaveBeenCalledTimes(calls);
  });

  test('stops polling when it unmounts (the plan turned Pro)', () => {
    const { unmount } = renderWithProviders(<PlanActivatingNotice />);
    unmount();
    act(() => { jest.advanceTimersByTime(ACTIVATION_POLL_MS * 3); });
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });
});
