import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { FilterDrawer } from '@/components/ui/filter-drawer';
import { act, renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';

function setup(overrides: Partial<React.ComponentProps<typeof FilterDrawer>> = {}) {
  const onOpenChange = mock((_open: boolean) => {});
  const onClearAll = mock(() => {});
  const props = {
    'open': true,
    onOpenChange,
    'title': 'Filtrar y ordenar',
    onClearAll,
    'hasActiveFilters': true,
    'footer': <button type="button">Aplicar</button>,
    'aria-label': 'Filtros de prueba',
    'data-testid': 'drawer',
    ...overrides,
  };
  const view = renderWithProviders(
    <FilterDrawer {...props}>
      <input aria-label="campo" />
    </FilterDrawer>,
  );
  return { onOpenChange, onClearAll, user: setupUser(), view, props };
}

describe('FilterDrawer', () => {
  test('renders nothing while closed', () => {
    setup({ open: false });

    expect(screen.queryByTestId('drawer')).toBeNull();
  });

  test('shows the title, the body and the footer as a labelled modal dialog', () => {
    setup();

    const dialog = screen.getByRole('dialog', { name: 'Filtros de prueba' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Filtrar y ordenar' })).toBeInTheDocument();
    expect(screen.getByLabelText('campo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
  });

  test('the close button asks to close', async () => {
    const { onOpenChange, user } = setup();

    await user.click(screen.getByTestId('drawer_close_button'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('Escape asks to close', async () => {
    const { onOpenChange, user } = setup();

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('clicking the scrim asks to close, clicking inside the panel does not', async () => {
    const { onOpenChange, user } = setup();

    await user.click(screen.getByLabelText('campo'));
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('drawer').parentElement as HTMLElement);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('"Borrar todo" appears only with active filters and fires onClearAll', async () => {
    const { onClearAll, user, view } = setup();

    await user.click(screen.getByRole('button', { name: 'Borrar todo' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);

    view.unmount();
    setup({ hasActiveFilters: false });
    expect(screen.queryByRole('button', { name: 'Borrar todo' })).toBeNull();
  });

  test('without a data-testid the buttons carry no test id', () => {
    setup({ 'data-testid': undefined });

    expect(screen.getByRole('button', { name: 'Cerrar' })).not.toHaveAttribute('data-testid');
    expect(screen.getByRole('button', { name: 'Borrar todo' })).not.toHaveAttribute('data-testid');
  });

  test('focuses the first focusable element and locks the page scroll while open', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Borrar todo' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('Tab wraps from the last element to the first and Shift+Tab from the first to the last', async () => {
    const { user } = setup();
    const first = screen.getByRole('button', { name: 'Borrar todo' });
    const last = screen.getByRole('button', { name: 'Aplicar' });

    last.focus();
    await user.tab();
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  test('restores the scroll and the focus when it closes, and unmounts after the exit', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onOpenChange = mock((_open: boolean) => {});
    const drawer = (open: boolean) => (
      <FilterDrawer open={open} onOpenChange={onOpenChange} title="T" onClearAll={() => {}} hasActiveFilters={false} footer={null} aria-label="x" data-testid="drawer">
        <input aria-label="campo" />
      </FilterDrawer>
    );
    const view = renderWithProviders(drawer(true));
    expect(document.body.style.overflow).toBe('hidden');

    view.rerender(drawer(false));

    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
    await act(async () => new Promise(resolve => setTimeout(resolve, 300)));
    expect(screen.queryByTestId('drawer')).toBeNull();
    trigger.remove();
  });

  test('re-opening during the exit keeps the panel mounted', async () => {
    const onOpenChange = mock((_open: boolean) => {});
    const drawer = (open: boolean) => (
      <FilterDrawer open={open} onOpenChange={onOpenChange} title="T" onClearAll={() => {}} hasActiveFilters={false} footer={null} aria-label="x" data-testid="drawer">
        <span>cuerpo</span>
      </FilterDrawer>
    );
    const view = renderWithProviders(drawer(true));

    view.rerender(drawer(false));
    view.rerender(drawer(true));
    await act(async () => new Promise(resolve => setTimeout(resolve, 250)));

    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  test('marks the panel as open once it has entered', async () => {
    setup();

    await waitFor(() => expect(screen.getByTestId('drawer')).toHaveClass('is-open'));
  });
});
