import { describe, expect, mock, test } from 'bun:test';
import { createRef } from 'react';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { Switch } from './switch';

/**
 * FRESCO-443 — `Switch` is the toggle primitive extracted from
 * `push-notifications-toggle.tsx`. A controlled `<button role="switch">`:
 * these tests pin `aria-checked`, the `onCheckedChange` contract (click +
 * keyboard), the `disabled` guard, and the forwarded ref.
 */

describe('Switch', () => {
  test('renders a switch with its label and reflects aria-checked', () => {
    const { rerender } = renderWithProviders(
      <Switch checked={false} onCheckedChange={() => {}} aria-label="Recordatorios" />,
    );
    const toggle = screen.getByRole('switch', { name: 'Recordatorios' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    rerender(<Switch checked onCheckedChange={() => {}} aria-label="Recordatorios" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  test('calls onCheckedChange with the negated value on click', async () => {
    const user = setupUser();
    const onCheckedChange = mock((_next: boolean) => {});
    renderWithProviders(
      <Switch checked={false} onCheckedChange={onCheckedChange} aria-label="Recordatorios" />,
    );

    await user.click(screen.getByRole('switch'));

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  test('toggles from a checked state', async () => {
    const user = setupUser();
    const onCheckedChange = mock((_next: boolean) => {});
    renderWithProviders(
      <Switch checked onCheckedChange={onCheckedChange} aria-label="Recordatorios" />,
    );

    await user.click(screen.getByRole('switch'));

    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  test('activates with the keyboard (Space and Enter)', async () => {
    const user = setupUser();
    const onCheckedChange = mock((_next: boolean) => {});
    renderWithProviders(
      <Switch checked={false} onCheckedChange={onCheckedChange} aria-label="Recordatorios" />,
    );

    await user.tab();
    expect(screen.getByRole('switch')).toHaveFocus();

    await user.keyboard('{ }');
    await user.keyboard('{Enter}');

    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  test('does not fire onCheckedChange while disabled', async () => {
    const user = setupUser();
    const onCheckedChange = mock((_next: boolean) => {});
    renderWithProviders(
      <Switch checked={false} onCheckedChange={onCheckedChange} disabled aria-label="Recordatorios" />,
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();

    await user.click(toggle);

    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  test('forwards the ref and pins the test id', () => {
    const ref = createRef<HTMLButtonElement>();
    renderWithProviders(
      <Switch
        ref={ref}
        checked={false}
        onCheckedChange={() => {}}
        aria-label="Recordatorios"
        data-testid="push_notifications_switch"
      />,
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(screen.getByTestId('push_notifications_switch')).toBe(ref.current);
  });
});
