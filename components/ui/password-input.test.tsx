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

  // FRESCO-936 — a visible label stays on screen while she types (WCAG 3.3.2),
  // and the toggle must work from the keyboard.
  describe('with a visible label', () => {
    test('renders the label as text and ties it to the input', () => {
      renderWithProviders(<PasswordInput value="" onChange={mock(() => {})} label="Contraseña" showStrength={false} />);

      expect(screen.getByText('Contraseña', { selector: 'label' })).toBeVisible();
      expect(screen.getByLabelText('Contraseña')).toBe(screen.getByTestId('password_input'));
    });

    test('uses the given id and forwards the validation attributes', () => {
      renderWithProviders(
        <PasswordInput
          value=""
          onChange={mock(() => {})}
          label="Contraseña"
          id="login-password"
          aria-invalid
          aria-describedby="login-password-error"
          showStrength={false}
        />,
      );

      const input = screen.getByTestId('password_input');
      expect(input).toHaveAttribute('id', 'login-password');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'login-password-error');
    });

    test('toggles with the keyboard and announces the state', async () => {
      const user = setupUser();
      renderWithProviders(<Harness />);
      const input = screen.getByTestId('password_input');
      const toggle = screen.getByTestId('password_toggle_visibility_button');

      input.focus();
      await user.tab();
      expect(toggle).toHaveFocus();
      expect(toggle).toHaveAccessibleName('Mostrar contraseña');

      await user.keyboard('{Enter}');

      expect(input).toHaveAttribute('type', 'text');
      expect(toggle).toHaveAccessibleName('Ocultar contraseña');
    });
  });

  // FRESCO-940 — the static policy hint sat at 11px (text-caption), under the
  // 12px floor the audit flagged; it must use the 13px body-sm token.
  test('renders the policy hint at body-sm size while the field is empty', async () => {
    const user = setupUser();
    function HintHarness() {
      const [value, setValue] = useState('');
      return <PasswordInput value={value} onChange={setValue} showPolicyHint />;
    }
    renderWithProviders(<HintHarness />);

    const hint = screen.getByTestId('password_policy_hint');
    expect(hint).toHaveTextContent('Mínimo 10 caracteres.');
    expect(hint.className).toContain('text-body-sm');
    expect(hint.className).not.toContain('text-caption');

    await user.type(screen.getByTestId('password_input'), 'a');

    expect(screen.queryByTestId('password_policy_hint')).toBeNull();
  });

  test('falls back to an aria-label when no visible label is given', () => {
    renderWithProviders(<PasswordInput value="" onChange={mock(() => {})} placeholder="Nueva contraseña" />);

    expect(screen.getByTestId('password_input')).toHaveAccessibleName('Nueva contraseña');
    expect(screen.queryByText('Nueva contraseña', { selector: 'label' })).toBeNull();
  });

  test('disables the input and the toggle when disabled', () => {
    renderWithProviders(<PasswordInput value="x" onChange={mock(() => {})} disabled />);

    expect(screen.getByTestId('password_input')).toBeDisabled();
    expect(screen.getByTestId('password_toggle_visibility_button')).toBeDisabled();
  });
});
