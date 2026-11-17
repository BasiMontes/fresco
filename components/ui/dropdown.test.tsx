import type { DropdownOption } from './dropdown';
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
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

// FRESCO-1224: the panel took a fixed 240px, which cut the sixth option of the onboarding goal list with no sign
// of more. happy-dom does no layout, so these tests feed the measurements in and check what the component decides:
// the height it grants, the side it opens to, and the fade that says there is more below.
describe('Dropdown panel sizing', () => {
  const SIX_OPTIONS: DropdownOption[] = Array.from({ length: 6 }, (_, index) => ({ value: `o${index + 1}`, label: `Opción ${index + 1}` }));
  const restores: (() => void)[] = [];

  afterEach(() => {
    while (restores.length) {
      restores.pop()!();
    }
  });

  function mockLayout({ top, bottom, viewport, scrollHeight, clientHeight }: { top: number, bottom: number, viewport: number, scrollHeight: number, clientHeight: number }) {
    const rectSpy = spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top, bottom, left: 0, right: 200, width: 200, height: bottom - top, x: 0, y: top, toJSON: () => ({}) });
    restores.push(() => rectSpy.mockRestore());

    const previousViewport = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: viewport, configurable: true, writable: true });
    restores.push(() => Object.defineProperty(window, 'innerHeight', { value: previousViewport, configurable: true, writable: true }));

    // happy-dom may define these on `HTMLElement.prototype` as well as on `Element.prototype`, and the nearer one wins,
    // so both are replaced (a mock on only one left `clientHeight` at 0 and made every list look scrollable).
    for (const target of [Element.prototype, HTMLElement.prototype]) {
      for (const [name, value] of [['scrollHeight', scrollHeight], ['clientHeight', clientHeight]] as const) {
        const original = Object.getOwnPropertyDescriptor(target, name);
        Object.defineProperty(target, name, { get: () => value, configurable: true });
        restores.push(() => {
          if (original) {
            Object.defineProperty(target, name, original);
          }
          else {
            delete (target as unknown as Record<string, unknown>)[name];
          }
        });
      }
    }
  }

  async function openSix() {
    const user = setupUser();
    renderWithProviders(<Dropdown options={SIX_OPTIONS} value={null} onChange={() => {}} data-testid="goal" aria-label="Objetivo" />);
    await user.click(screen.getByTestId('goal'));
    return screen.getByRole('listbox');
  }

  test('grants enough height for six options instead of the old 240px', async () => {
    mockLayout({ top: 100, bottom: 140, viewport: 800, scrollHeight: 248, clientHeight: 248 });

    const list = await openSix();

    expect(Number.parseInt(list.style.maxHeight, 10)).toBeGreaterThanOrEqual(248);
    expect(list.className).not.toContain('max-h-60');
  });

  test('keeps the panel below the trigger when it fits there', async () => {
    mockLayout({ top: 100, bottom: 140, viewport: 800, scrollHeight: 248, clientHeight: 248 });

    const list = await openSix();

    expect(list.parentElement?.className).toContain('top-full');
    expect(list.parentElement?.className).not.toContain('bottom-full');
  });

  test('opens upward when it does not fit below and there is more room above', async () => {
    mockLayout({ top: 700, bottom: 740, viewport: 800, scrollHeight: 248, clientHeight: 248 });

    const list = await openSix();

    expect(list.parentElement?.className).toContain('bottom-full');
    expect(list.parentElement?.className).not.toContain('top-full');
  });

  test('limits the height to the room the window has when it is smaller than the list', async () => {
    mockLayout({ top: 60, bottom: 100, viewport: 220, scrollHeight: 400, clientHeight: 112 });

    const list = await openSix();

    expect(Number.parseInt(list.style.maxHeight, 10)).toBeLessThanOrEqual(220);
  });

  test('shows a fade while content is hidden below and removes it at the end of the list', async () => {
    mockLayout({ top: 100, bottom: 140, viewport: 800, scrollHeight: 600, clientHeight: 300 });

    const list = await openSix();
    const cue = () => list.parentElement?.querySelector('[data-scroll-cue]');

    // Booleans on purpose: a failed `toBeNull()` on a DOM node makes the runner print the whole window.
    expect(cue() !== null).toBe(true);
    expect(cue()?.getAttribute('aria-hidden')).toBe('true');

    Object.defineProperty(list, 'scrollTop', { value: 300, configurable: true });
    fireEvent.scroll(list);

    expect(cue() === null).toBe(true);
  });

  test('shows no fade when everything fits', async () => {
    mockLayout({ top: 100, bottom: 140, viewport: 800, scrollHeight: 248, clientHeight: 248 });

    const list = await openSix();

    expect(list.parentElement?.querySelector('[data-scroll-cue]') === null).toBe(true);
  });

  test('the last option is reachable and selectable', async () => {
    mockLayout({ top: 100, bottom: 140, viewport: 800, scrollHeight: 248, clientHeight: 248 });
    const user = setupUser();
    const onChange = mock(() => {});
    renderWithProviders(<Dropdown options={SIX_OPTIONS} value={null} onChange={onChange} data-testid="goal" aria-label="Objetivo" />);

    await user.click(screen.getByTestId('goal'));
    await user.keyboard('{End}');
    expect(screen.getByRole('option', { name: 'Opción 6' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('o6');
  });
});
