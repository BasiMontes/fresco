import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { MenuGrid, SlotKey } from '@/lib/calendar/apply-slot-swap';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { MealPlanError } from '@/lib/api/meal-plan';
import * as clientMealPlan from '@/lib/client-api/meal-plan';
import { act, renderHook } from '@/tests/component-render';
import { useCalendarDragDrop } from './use-calendar-drag-drop';

// FRESCO-1076 — what a drop does: swap optimistically, save in the background,
// put the grid back and say why when the save fails. A different meal type or a
// slot already being saved never reaches the server.

const lunesComida: SlotKey = { dia: 'lunes', tipo: 'comida' };
const martesComida: SlotKey = { dia: 'martes', tipo: 'comida' };
const martesCena: SlotKey = { dia: 'martes', tipo: 'cena' };

const receta = (titulo: string) => ({ nombre: titulo }) as unknown as NonNullable<MenuGrid['lunes']['comida']>;

function menuInicial(): MenuGrid {
  const vacio = { desayuno: null, comida: null, cena: null };
  return {
    lunes: { ...vacio, comida: receta('Lentejas') },
    martes: { ...vacio, comida: receta('Paella'), cena: receta('Tortilla') },
  } as unknown as MenuGrid;
}

const slotIds = {
  lunes: { desayuno: 'l-d', comida: 'l-c', cena: 'l-n' },
  martes: { desayuno: 'm-d', comida: 'm-c', cena: 'm-n' },
} as unknown as Parameters<typeof useCalendarDragDrop>[0]['slotIds'];

function drop(from: SlotKey | undefined, to: SlotKey | undefined, sameId = false): DragEndEvent {
  return {
    active: { id: 'a', data: { current: from } },
    over: to === undefined && !sameId ? null : { id: sameId ? 'a' : 'b', data: { current: to } },
  } as unknown as DragEndEvent;
}

let swapSpy: ReturnType<typeof spyOn<typeof clientMealPlan, 'swapMealPlanSlots'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;
const setErrorMessage = mock((_m: string | null) => {});

beforeEach(() => {
  setErrorMessage.mockClear();
  swapSpy = spyOn(clientMealPlan, 'swapMealPlanSlots').mockResolvedValue(undefined);
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  swapSpy.mockRestore();
  errorSpy.mockRestore();
});

function setup(pendingInicial: string[] = []) {
  const estado = { menu: menuInicial(), pending: new Set<string>(pendingInicial) };
  const view = renderHook(() => useCalendarDragDrop({
    slotIds,
    setMenu: (fn) => { estado.menu = typeof fn === 'function' ? fn(estado.menu) : fn; },
    setErrorMessage,
    pendingSlots: estado.pending,
    setPendingSlots: (fn) => { estado.pending = typeof fn === 'function' ? new Set(fn(estado.pending)) : new Set(fn); },
  }));
  return { estado, view };
}

describe('useCalendarDragDrop', () => {
  test('exposes the three sensors and nothing being dragged at first', () => {
    const { view } = setup();
    expect(view.result.current.sensors).toHaveLength(3);
    expect(view.result.current.draggingTipo).toBeNull();
  });

  test('drag start records the meal type being dragged, drag end clears it', () => {
    const { view } = setup();
    act(() => view.result.current.handleDragStart({ active: { data: { current: lunesComida } } } as unknown as DragStartEvent));
    expect(view.result.current.draggingTipo).toBe('comida');
    act(() => view.result.current.handleDragEnd(drop(undefined, undefined)));
    expect(view.result.current.draggingTipo).toBeNull();
  });

  test('a drag that carries no slot data leaves nothing being dragged', () => {
    const { view } = setup();
    act(() => view.result.current.handleDragStart({ active: { data: { current: undefined } } } as unknown as DragStartEvent));
    expect(view.result.current.draggingTipo).toBeNull();
  });

  test('a drop on the same slot, outside the grid, or without slot data does nothing', () => {
    const { view } = setup();
    act(() => view.result.current.handleDragEnd(drop(lunesComida, undefined, true)));
    act(() => view.result.current.handleDragEnd(drop(lunesComida, undefined)));
    act(() => view.result.current.handleDragEnd(drop(undefined, martesComida)));
    expect(swapSpy).not.toHaveBeenCalled();
  });

  test('a recipe never moves to a different meal type: no swap, no request', () => {
    const { view, estado } = setup();
    act(() => view.result.current.handleDragEnd(drop(lunesComida, martesCena)));
    expect(swapSpy).not.toHaveBeenCalled();
    expect(estado.menu.lunes.comida?.nombre).toBe('Lentejas');
  });

  test('a slot that is already being saved cannot be dragged again', () => {
    const { view } = setup(['lunes:comida']);
    act(() => view.result.current.handleDragEnd(drop(lunesComida, martesComida)));
    expect(swapSpy).not.toHaveBeenCalled();
  });

  test('a valid drop swaps the grid at once and saves the two slot ids', async () => {
    const { view, estado } = setup();
    await act(async () => view.result.current.handleDragEnd(drop(lunesComida, martesComida)));
    expect(estado.menu.lunes.comida?.nombre).toBe('Paella');
    expect(estado.menu.martes.comida?.nombre).toBe('Lentejas');
    expect(swapSpy).toHaveBeenCalledWith({ slotAId: 'l-c', slotBId: 'm-c' });
    expect(setErrorMessage).toHaveBeenCalledWith(null);
    expect(estado.pending.size).toBe(0);
  });

  test('marks both slots as pending while the save is in flight', () => {
    let terminar: () => void = () => {};
    swapSpy.mockImplementation(async () => new Promise<never>((resolve) => { terminar = () => resolve(undefined as never); }));
    const { view, estado } = setup();
    act(() => view.result.current.handleDragEnd(drop(lunesComida, martesComida)));
    expect([...estado.pending].sort()).toEqual(['lunes:comida', 'martes:comida']);
    terminar();
  });

  test('a rejected save puts the grid back and says the menu changed under the user', async () => {
    swapSpy.mockRejectedValue(new MealPlanError('stale'));
    const { view, estado } = setup();
    await act(async () => view.result.current.handleDragEnd(drop(lunesComida, martesComida)));
    expect(estado.menu.lunes.comida?.nombre).toBe('Lentejas');
    expect(estado.menu.martes.comida?.nombre).toBe('Paella');
    expect(setErrorMessage).toHaveBeenLastCalledWith('No se pudo guardar el nuevo orden: el menú cambió mientras tanto. Actualiza la página.');
    expect(estado.pending.size).toBe(0);
  });

  test('a network failure puts the grid back and asks the user to check the connection', async () => {
    swapSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const { view, estado } = setup();
    await act(async () => view.result.current.handleDragEnd(drop(lunesComida, martesComida)));
    expect(estado.menu.lunes.comida?.nombre).toBe('Lentejas');
    expect(setErrorMessage).toHaveBeenLastCalledWith('No se pudo guardar el nuevo orden. Revisa tu conexión e inténtalo de nuevo.');
  });
});
