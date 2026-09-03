import type { DropdownOption } from './dropdown';
import { describe, expect, mock, test } from 'bun:test';
import { useState } from 'react';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { Dropdown } from './dropdown';

/**
 * FRESCO-409 — `Dropdown` is a custom listbox (not a native `<select>`):
 * these tests pin the open/close cycle, selection wiring, the placeholder
 * vs. selected-label swap, and `aria-expanded`.
 */

const OPTIONS: DropdownOption[] = [
  { value: 'es', label: 'España' },
  { value: 'mx', label: 'México' },
  { value: 'ar', label: 'Argentina' },
];

function Harness({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <Dropdown
      options={OPTIONS}
      value={value}
      onChange={setValue}
      data-testid="country_dropdown"
      aria-label="País"
    />
  );
}

describe('Dropdown', () => {
  test('shows the placeholder when nothing is selected, the label once it is', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);
    const trigger = screen.getByTestId('country_dropdown');

    expect(trigger).toHaveTextContent('Selecciona una opción');

    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'México' }));

    expect(trigger).toHaveTextContent('México');
  });

  test('opens on trigger click and reflects aria-expanded', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);
    const trigger = screen.getByTestId('country_dropdown');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  test('calls onChange with the chosen value and closes the list', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    renderWithProviders(
      <Dropdown options={OPTIONS} value={null} onChange={onChange} data-testid="d" aria-label="País" />,
    );

    await user.click(screen.getByTestId('d'));
    await user.click(screen.getByRole('option', { name: 'Argentina' }));

    expect(onChange).toHaveBeenCalledWith('ar');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  test('closes on Escape', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    await user.click(screen.getByTestId('country_dropdown'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  test('marks the current value as the selected option', async () => {
    const user = setupUser();
    renderWithProviders(<Harness initial="es" />);

    await user.click(screen.getByTestId('country_dropdown'));

    expect(screen.getByRole('option', { name: 'España' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'México' })).toHaveAttribute('aria-selected', 'false');
  });
});
