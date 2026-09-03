import { describe, expect, mock, test } from 'bun:test';
import { createRef } from 'react';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { Checkbox } from './checkbox';

/**
 * FRESCO-409 — `Checkbox` renders a real `<input type="checkbox">` (the
 * visible circle is a decorative sibling). These tests guard that the
 * native input stays the interactive element: controlled `checked`, a
 * forwarded ref, and pass-through of arbitrary input props.
 */

describe('Checkbox', () => {
  test('renders a native checkbox input', () => {
    renderWithProviders(<Checkbox aria-label="Acepto" onChange={() => {}} />);
    const input = screen.getByRole('checkbox', { name: 'Acepto' });
    expect(input).toHaveProperty('type', 'checkbox');
  });

  test('reflects the controlled checked prop', () => {
    const { rerender } = renderWithProviders(
      <Checkbox aria-label="Acepto" checked={false} onChange={() => {}} />,
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    rerender(<Checkbox aria-label="Acepto" checked onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  test('fires onChange when clicked', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    renderWithProviders(<Checkbox aria-label="Acepto" onChange={onChange} />);

    await user.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('forwards the ref to the input and passes through props', () => {
    const ref = createRef<HTMLInputElement>();
    renderWithProviders(<Checkbox ref={ref} id="tos" disabled aria-label="Acepto" onChange={() => {}} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.id).toBe('tos');
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
