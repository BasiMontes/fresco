import type { DropdownOption } from './dropdown';
import { describe, expect, mock, test } from 'bun:test';
import { useState } from 'react';
import { fireEvent, renderWithProviders, screen, setupUser } from '@/tests/component-render';
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

  test('keeps the visible text inside the trigger accessible name', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);
    const trigger = screen.getByTestId('country_dropdown');

    expect(trigger).toHaveAttribute('aria-label', 'País: Selecciona una opción');

    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'México' }));

    expect(trigger).toHaveAttribute('aria-label', 'País: México');
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

// WAI-ARIA listbox keyboard pattern (FRESCO-181) and the click-outside / WebKit phantom-click guards (FRESCO-151).
describe('Dropdown keyboard and focus', () => {
  async function open(initial: string | null = null) {
    const user = setupUser();
    renderWithProviders(<Harness initial={initial} />);
    const trigger = screen.getByTestId('country_dropdown');
    await user.click(trigger);
    return { user, trigger };
  }

  const option = (name: string) => screen.getByRole('option', { name });

  test('opens with focus on the selected option, or on the first one when nothing is selected', async () => {
    await open('mx');
    expect(option('México')).toHaveFocus();
    expect(option('México')).toHaveAttribute('tabindex', '0');
    expect(option('España')).toHaveAttribute('tabindex', '-1');
  });

  test('focuses the first option when nothing is selected', async () => {
    await open();
    expect(option('España')).toHaveFocus();
  });

  test('ArrowDown and ArrowUp move the focus and stop at both ends', async () => {
    const { user } = await open();

    await user.keyboard('{ArrowUp}');
    expect(option('España')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(option('México')).toHaveFocus();

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(option('Argentina')).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(option('México')).toHaveFocus();
  });

  test('Home and End jump to the first and last option', async () => {
    const { user } = await open('mx');

    await user.keyboard('{End}');
    expect(option('Argentina')).toHaveFocus();

    await user.keyboard('{Home}');
    expect(option('España')).toHaveFocus();
  });

  test('Enter picks the focused option, closes the list and returns focus to the trigger', async () => {
    const { user, trigger } = await open();

    await user.keyboard('{ArrowDown}{Enter}');

    expect(trigger).toHaveTextContent('México');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  test('Space picks the focused option too', async () => {
    const { user, trigger } = await open();

    await user.keyboard('{End}{ }');

    expect(trigger).toHaveTextContent('Argentina');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  test('Escape inside the list closes it and returns focus to the trigger', async () => {
    const { user, trigger } = await open();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  test('Escape pressed on the trigger itself closes the list', async () => {
    const { trigger } = await open();

    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  test('Tab closes the list', async () => {
    const { user } = await open();

    await user.keyboard('{Tab}');

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  test('a press outside the component closes the list', async () => {
    await open();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  test('a press inside the component does not close it', async () => {
    await open();

    fireEvent.mouseDown(option('México'));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  test('swallows the phantom click WebKit fires on the trigger right after a pick, then works again', async () => {
    const { user, trigger } = await open();

    await user.click(option('México'));
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
