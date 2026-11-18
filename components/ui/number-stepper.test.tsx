import { describe, expect, mock, test } from 'bun:test';
import { fireEvent, renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { NumberStepper } from './number-stepper';

// FRESCO-1225 — a number field with - and + buttons that stop at min/max. The
// number stays typeable so an out-of-range value can still be entered and
// rejected by the caller's validation.

function renderStepper(props: Partial<React.ComponentProps<typeof NumberStepper>> = {}) {
  const onChange = mock((_: number) => {});
  renderWithProviders(
    <NumberStepper label="Adultos" value={2} min={1} max={10} onChange={onChange} data-testid="adultos" {...props} />,
  );
  return onChange;
}

describe('NumberStepper', () => {
  test('is a labelled group with the value in the field', () => {
    renderStepper();
    expect(screen.getByRole('group', { name: 'Adultos' })).toBeInTheDocument();
    expect(screen.getByTestId('adultos')).toHaveValue(2);
  });

  test('+ and - step by one', async () => {
    const onChange = renderStepper();
    const user = setupUser();
    await user.click(screen.getByTestId('adultos_increment'));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await user.click(screen.getByTestId('adultos_decrement'));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  test('disables - at the minimum and + at the maximum', () => {
    renderStepper({ value: 1 });
    expect(screen.getByTestId('adultos_decrement')).toBeDisabled();
    expect(screen.getByTestId('adultos_increment')).toBeEnabled();
  });

  test('disables + at the maximum', () => {
    renderStepper({ value: 10 });
    expect(screen.getByTestId('adultos_increment')).toBeDisabled();
    expect(screen.getByTestId('adultos_decrement')).toBeEnabled();
  });

  test('buttons carry accessible names and a 44 px target', () => {
    renderStepper();
    const dec = screen.getByRole('button', { name: 'Quitar uno: Adultos' });
    expect(dec.className).toContain('size-11');
    expect(screen.getByRole('button', { name: 'Añadir uno: Adultos' })).toBeInTheDocument();
  });

  test('typing reports the number, so out-of-range values reach validation', () => {
    const onChange = renderStepper();
    fireEvent.change(screen.getByTestId('adultos'), { target: { value: '999' } });
    expect(onChange).toHaveBeenLastCalledWith(999);
  });

  test('flags the field as invalid', () => {
    renderStepper({ invalid: true });
    expect(screen.getByTestId('adultos')).toHaveAttribute('aria-invalid', 'true');
  });
});
