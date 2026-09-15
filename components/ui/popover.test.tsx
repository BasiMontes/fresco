import { describe, expect, mock, test } from 'bun:test';
import { useRef, useState } from 'react';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { Popover } from './popover';

/**
 * FRESCO-514 — `Popover` is a hand-rolled panel-only overlay (the caller
 * renders its own trigger, `Dialog`-style composition): these tests pin the
 * open/close cycle via the caller's own trigger, outside-click and Escape
 * closing, and focus-trap/focus-return.
 */

function Harness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={triggerRef} type="button" data-testid="trigger" onClick={() => setOpen(current => !current)}>
        Cuenta
      </button>
      <Popover open={open} onOpenChange={setOpen} aria-label="Menú de cuenta" data-testid="account_popover" triggerRef={triggerRef}>
        <a href="/profile" data-testid="first_item">Perfil</a>
        <button type="button" data-testid="last_item">Cerrar sesión</button>
      </Popover>
      <button type="button" data-testid="outside">Fuera</button>
    </div>
  );
}

describe('Popover', () => {
  test('opens on trigger click', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(screen.getByTestId('trigger'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  test('closes on outside click', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));

    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('closes on Escape', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('re-clicking the trigger while open closes it instead of reopening', async () => {
    // FRESCO-514 fix-and-iterate, PR #361 BLOCKER — the click-outside
    // `mousedown` handler had no reference to the trigger, so a `mousedown`
    // on the trigger while open was treated as "outside" and queued
    // `onOpenChange(false)`, then the trigger's own `click` handler fired
    // right after and flipped it back to `true` against stale state: the
    // popover never closed via re-clicking the trigger. `triggerRef` fixes
    // it by excluding the trigger from that check.
    const user = setupUser();
    renderWithProviders(<Harness />);
    const trigger = screen.getByTestId('trigger');

    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(trigger);

    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('returns focus to the trigger on close', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);
    const trigger = screen.getByTestId('trigger');

    trigger.focus();
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  test('traps Tab focus inside the open panel', async () => {
    const user = setupUser();
    renderWithProviders(<Harness />);

    await user.click(screen.getByTestId('trigger'));
    const first = screen.getByTestId('first_item');
    const last = screen.getByTestId('last_item');

    expect(first).toHaveFocus();

    last.focus();
    await user.tab();

    expect(first).toHaveFocus();

    await user.tab({ shift: true });

    expect(last).toHaveFocus();
  });

  test('calling onOpenChange(false) unmounts the panel', () => {
    const onOpenChange = mock(() => {});
    renderWithProviders(
      <Popover open={false} onOpenChange={onOpenChange} aria-label="Menú" data-testid="p">
        <span>content</span>
      </Popover>,
    );

    expect(screen.queryByRole('menu')).toBeNull();
  });
});
