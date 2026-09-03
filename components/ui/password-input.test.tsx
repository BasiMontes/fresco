import { describe, expect, mock, test } from 'bun:test';
import { useState } from 'react';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { PasswordInput } from './password-input';

/**
 * FRESCO-409 — `PasswordInput` combines a show/hide toggle with a live
 * strength meter that only appears once she has typed something. These
 * tests pin both branches plus the disabled state.
 */

function Harness({ initial = '', showStrength = true }: { initial?: string, showStrength?: boolean }) {
  const [value, setValue] = useState(initial);
  return <PasswordInput value={value} onChange={setValue} showStrength={showStrength} />;
}

describe('PasswordInput', () => {
  test('masks the value by default and toggles to plain text', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);
    const input = screen.getByTestId('password_input');
    const toggle = screen.getByTestId('password_toggle_visibility_button');

    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('hides the strength meter until a character is typed', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    expect(screen.queryByTestId('password_strength_indicator')).toBeNull();

    await user.type(screen.getByTestId('password_input'), 'a');

    expect(screen.getByTestId('password_strength_indicator')).toBeInTheDocument();
  });

  test('labels a varied long password as "Fuerte"', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    await user.type(screen.getByTestId('password_input'), 'Fresco2026!segur');

    expect(screen.getByTestId('password_strength_indicator')).toHaveTextContent('Fuerte');
  });

  test('never renders the meter when showStrength is off', async () => {
    const user = setupUser();
    renderWithProviders(<Harness showStrength={false} />);

    await user.type(screen.getByTestId('password_input'), 'whatever123');

    expect(screen.queryByTestId('password_strength_indicator')).toBeNull();
  });

  test('disables the input and the toggle when disabled', () => {
    renderWithProviders(<PasswordInput value="x" onChange={mock(() => {})} disabled />);

    expect(screen.getByTestId('password_input')).toBeDisabled();
    expect(screen.getByTestId('password_toggle_visibility_button')).toBeDisabled();
  });
});
