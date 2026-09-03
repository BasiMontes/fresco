import { describe, expect, mock, test } from 'bun:test';
import { useState } from 'react';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { EmailInput } from './email-input';

/**
 * FRESCO-409 — `EmailInput` surfaces its format error only after the field
 * has been blurred AND holds a non-empty invalid value. These tests pin
 * that touched-gate so a future refactor can't regress it back to
 * flashing the error while she is still typing.
 */

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <EmailInput value={value} onChange={setValue} />;
}

describe('EmailInput', () => {
  test('renders no validation error before the field is blurred', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    await user.type(screen.getByTestId('email_input'), 'not-an-email');

    expect(screen.queryByTestId('email_validation_message')).toBeNull();
    expect(screen.getByTestId('email_input')).toHaveAttribute('aria-invalid', 'false');
  });

  test('shows the error after blur when the value is non-empty and invalid', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);
    const input = screen.getByTestId('email_input');

    await user.type(input, 'nope@');
    await user.tab();

    expect(screen.getByTestId('email_validation_message')).toHaveTextContent('Introduce un email válido.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  test('keeps a valid address error-free after blur', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    await user.type(screen.getByTestId('email_input'), 'laura@fresco.app');
    await user.tab();

    expect(screen.queryByTestId('email_validation_message')).toBeNull();
  });

  test('does not error on an empty blurred field', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    await user.click(screen.getByTestId('email_input'));
    await user.tab();

    expect(screen.queryByTestId('email_validation_message')).toBeNull();
  });

  test('propagates each keystroke through onChange', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    renderWithProviders(<EmailInput value="" onChange={onChange} />);

    await user.type(screen.getByTestId('email_input'), 'ab');

    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
