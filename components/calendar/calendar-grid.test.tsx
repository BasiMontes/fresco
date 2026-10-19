import type { MenuGrid } from '@/lib/calendar/apply-slot-swap';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, jest, mock, test } from 'bun:test';
import { makeFixtureRecipe } from '@/lib/fixtures/recipe';
import { act, renderWithProviders, screen, setupUser, waitFor, within } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

/**
 * FRESCO-1014 (A7-UI-12, A7-UI-13) — the calendar marks "hoy" only when today falls inside the viewed week,
 * opens on today on a phone, and its day arrows are 44 px.
 */

void mock.module('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } }) }));

const { CalendarGrid } = await import('./calendar-grid');

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

const menu = Object.fromEntries(DIAS.map(dia => [dia, Object.fromEntries(TIPOS.map(tipo => [tipo, null]))])) as MenuGrid;
const slotIds = Object.fromEntries(DIAS.map(dia => [dia, Object.fromEntries(TIPOS.map(tipo => [tipo, `${dia}-${tipo}`]))])) as Record<(typeof DIAS)[number], Record<(typeof TIPOS)[number], string>>;
const estados = Object.fromEntries(DIAS.map(dia => [dia, Object.fromEntries(TIPOS.map(tipo => [tipo, 'pendiente']))])) as never;

const realObserver = globalThis.ResizeObserver;
afterEach(() => {
  globalThis.ResizeObserver = realObserver;
  // `bun test` shares one process and one happy-dom: drop the width override so no other file sees it.
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

/** Gives the grid a container of `width` px: the hook measures it with a ResizeObserver. */
function containerOf(width: number) {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
}

function renderGrid(props: { mondayIso?: string, hoyIso?: string }) {
  return renderWithProviders(<CalendarGrid initialMenu={menu} slotIds={slotIds} initialEstados={estados} {...props} />);
}

describe('CalendarGrid — "hoy" (A7-UI-12)', () => {
  test('marks today in the current week, in the day it really is', () => {
    containerOf(3000);
    // Monday 2026-10-12 .. Sunday 2026-10-18; today Friday the 16th.
    renderGrid({ mondayIso: '2026-10-12', hoyIso: '2026-10-16' });

    const marked = screen.getAllByText(/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)$/).filter(node => node.className.includes('bg-secondary'));
    expect(marked.map(node => node.textContent)).toEqual(['Viernes']);
  });

  test('marks nothing in a past or future week, whatever the weekday of today is', () => {
    containerOf(3000);
    renderGrid({ mondayIso: '2026-10-05', hoyIso: '2026-10-16' });

    const marked = screen.getAllByText(/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)$/).filter(node => node.className.includes('bg-secondary'));
    expect(marked).toEqual([]);
  });

  test('marks nothing when the page gives no dates', () => {
    containerOf(3000);
    renderGrid({});

    expect(screen.getAllByText(/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)$/).filter(node => node.className.includes('bg-secondary'))).toEqual([]);
  });

  test('Madrid frame: the server resolves the date, so 23:30 UTC on a Sunday is already Monday', () => {
    containerOf(3000);
    // The page passes hoyEnMadrid(); here we pass what it would return at 2026-10-18T23:30Z (Madrid: Monday 19th, next week).
    renderGrid({ mondayIso: '2026-10-19', hoyIso: '2026-10-19' });

    const marked = screen.getAllByText(/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)$/).filter(node => node.className.includes('bg-secondary'));
    expect(marked.map(node => node.textContent)).toEqual(['Lunes']);
  });
});

describe('CalendarGrid — mobile (A7-UI-13)', () => {
  test('opens on today in the current week', async () => {
    containerOf(360);
    renderGrid({ mondayIso: '2026-10-12', hoyIso: '2026-10-16' });

    expect(await screen.findByText('Viernes')).toBeInTheDocument();
    expect(screen.queryByText('Lunes')).toBeNull();
  });

  test('opens on Monday in any other week', async () => {
    containerOf(360);
    renderGrid({ mondayIso: '2026-10-05', hoyIso: '2026-10-16' });

    expect(await screen.findByText('Lunes')).toBeInTheDocument();
    expect(screen.queryByText('Viernes')).toBeNull();
  });

  test('the day arrows are 44 px', () => {
    containerOf(360);
    renderGrid({ mondayIso: '2026-10-12', hoyIso: '2026-10-16' });

    const nav = screen.getByTestId('calendar_day_nav');
    for (const testid of ['calendar_day_nav_prev', 'calendar_day_nav_next']) {
      expect(within(nav).getByTestId(testid).className).toContain('size-11');
    }
  });
});

describe('CalendarGrid — changing a mark (FRESCO-1014, A7-UI-15)', () => {
  const recipe = makeFixtureRecipe();
  const markedMenu = { ...menu, viernes: { ...menu.viernes, comida: recipe } } as MenuGrid;
  const markedEstados = { ...(estados as Record<string, Record<string, string>>), viernes: { desayuno: 'pendiente', comida: 'cocinada', cena: 'pendiente' } } as never;

  function renderMarked(props: { mondayIso: string, hoyIso: string }) {
    return renderWithProviders(<CalendarGrid initialMenu={markedMenu} slotIds={slotIds} initialEstados={markedEstados} {...props} />);
  }

  test('inside the current week a marked dish offers "Quitar marca" and the switch to the other mark', () => {
    containerOf(3000);
    renderMarked({ mondayIso: '2026-10-12', hoyIso: '2026-10-16' });

    expect(screen.getByTestId('calendar_slot_viernes_comida_unmark')).toHaveTextContent('Quitar marca');
    expect(screen.getByTestId('calendar_slot_viernes_comida_switch')).toHaveTextContent('Cambiar a descartado');
  });

  test('in any other week the mark stays closed: a badge and no controls', () => {
    containerOf(3000);
    renderMarked({ mondayIso: '2026-10-05', hoyIso: '2026-10-16' });

    expect(screen.getByTestId('calendar_slot_viernes_comida_estado_badge')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar_slot_viernes_comida_unmark')).toBeNull();
    expect(screen.queryByTestId('calendar_slot_viernes_comida_switch')).toBeNull();
  });

  test('"Quitar marca" shows the snackbar with "Deshacer" and the slot goes back to open', async () => {
    containerOf(3000);
    const user = setupUser();
    renderMarked({ mondayIso: '2026-10-12', hoyIso: '2026-10-16' });

    await user.click(screen.getByTestId('calendar_slot_viernes_comida_unmark'));

    expect(screen.getByTestId('mark_undo_snackbar')).toHaveTextContent('Marca quitada');
    expect(screen.getByTestId('mark_undo_button')).toBeInTheDocument();
    expect(screen.getByTestId('calendar_slot_viernes_comida_mark_cocinada')).toBeInTheDocument();
  });

  test('the "Deshacer" window lasts at least ten seconds before the change is sent', async () => {
    containerOf(3000);
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ ok: true, estado: 'pendiente' }), { status: 200 });
    }) as unknown as typeof fetch;
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: ms => jest.advanceTimersByTime(ms) });
      renderMarked({ mondayIso: '2026-10-12', hoyIso: '2026-10-16' });

      await user.click(screen.getByTestId('calendar_slot_viernes_comida_unmark'));
      act(() => { jest.advanceTimersByTime(9_900); });
      expect(calls.filter(url => url.includes('update-recipe-status'))).toHaveLength(0);
      expect(screen.getByTestId('mark_undo_snackbar')).toBeInTheDocument();

      act(() => { jest.advanceTimersByTime(200); });
      await waitFor(() => expect(calls.filter(url => url.includes('update-recipe-status'))).toHaveLength(1));
    }
    finally {
      jest.useRealTimers();
      globalThis.fetch = original;
    }
  });
});
