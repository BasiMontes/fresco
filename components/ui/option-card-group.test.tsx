import { describe, expect, mock, test } from 'bun:test';
import { useState } from 'react';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { OptionCardGroup } from './option-card-group';

// FRESCO-1225 — all options visible as cards, ARIA radiogroup with a roving
// tabindex and arrow-key selection (same contract as SegmentedControl).

const OPTIONS = [
  { value: 'a', label: 'Uno', description: 'Primera ayuda' },
  { value: 'b', label: 'Dos' },
  { value: 'c', label: 'Tres' },
];

function Harness({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return <OptionCardGroup options={OPTIONS} value={value} onChange={setValue} aria-label="Cifras" data-testid="grupo" />;
}

describe('OptionCardGroup', () => {
  test('is a radiogroup that shows every option and its help line', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Cifras' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByText('Primera ayuda')).toBeInTheDocument();
  });

  test('marks the selected option with aria-checked', () => {
    renderWithProviders(<Harness initial="b" />);
    expect(screen.getByRole('radio', { name: 'Dos' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Uno/ })).not.toBeChecked();
  });

  test('clicking an option reports its value', async () => {
    const onChange = mock(() => {});
    renderWithProviders(<OptionCardGroup options={OPTIONS} value={null} onChange={onChange} aria-label="Cifras" />);
    await setupUser().click(screen.getByRole('radio', { name: 'Tres' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  test('arrow keys move selection and focus, wrapping at the ends', async () => {
    const user = setupUser();
    renderWithProviders(<Harness initial="a" />);
    screen.getByRole('radio', { name: /Uno/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Dos' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Dos' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('radio', { name: /Uno/ })).toBeChecked();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Tres' })).toBeChecked();
  });

  test('keeps one Tab stop: the checked option, or the first when none is', () => {
    const { unmount } = renderWithProviders(<Harness initial="b" />);
    expect(screen.getByRole('radio', { name: 'Dos' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Tres' })).toHaveAttribute('tabindex', '-1');
    unmount();
    renderWithProviders(<Harness />);
    expect(screen.getByRole('radio', { name: /Uno/ })).toHaveAttribute('tabindex', '0');
  });

  test('gives every option its own test id', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByTestId('grupo')).toBeInTheDocument();
    expect(screen.getByTestId('grupo_option_b')).toBeInTheDocument();
  });
});
