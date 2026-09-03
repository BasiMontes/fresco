import type { SegmentedControlOption } from './segmented-control';
import { describe, expect, mock, test } from 'bun:test';
import { useState } from 'react';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { SegmentedControl } from './segmented-control';

/**
 * FRESCO-409 — `SegmentedControl` implements the ARIA `radiogroup` pattern:
 * click selects, arrow keys move selection AND focus with wrap-around, and
 * a roving tabindex keeps a single Tab stop. These tests pin that keyboard
 * contract.
 */

const OPTIONS: SegmentedControlOption[] = [
  { value: 'suave', label: 'Suave' },
  { value: 'medio', label: 'Medio' },
  { value: 'picante', label: 'Picante' },
];

function Harness({ initial = 'suave' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <SegmentedControl options={OPTIONS} value={value} onChange={setValue} aria-label="Nivel de picante" />;
}

describe('SegmentedControl', () => {
  test('marks the selected option with aria-checked', () => {
    renderWithProviders(<Harness initial="medio" />);

    expect(screen.getByRole('radio', { name: 'Medio' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Suave' })).not.toBeChecked();
  });

  test('selects the clicked option', async () => {
    const user = setupUser();
    const onChange = mock(() => {});
    renderWithProviders(
      <SegmentedControl options={OPTIONS} value="suave" onChange={onChange} aria-label="Nivel" />,
    );

    await user.click(screen.getByRole('radio', { name: 'Picante' }));

    expect(onChange).toHaveBeenCalledWith('picante');
  });

  test('arrow keys move selection and wrap at the ends', async () => {
    const user = setupUser();
    renderWithProviders(<Harness initial="suave" />);

    screen.getByRole('radio', { name: 'Suave' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Medio' })).toBeChecked();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Picante' })).toBeChecked();
  });

  test('keeps a single Tab stop via roving tabindex', () => {
    renderWithProviders(<Harness initial="medio" />);

    expect(screen.getByRole('radio', { name: 'Medio' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Suave' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('radio', { name: 'Picante' })).toHaveAttribute('tabindex', '-1');
  });
});
