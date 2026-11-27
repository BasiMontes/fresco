import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as React from 'react';
import * as edgeFunctions from '@/lib/api/edge-functions';
import * as authApi from '@/lib/client-api/auth';
import * as mealPlanApi from '@/lib/client-api/meal-plan';
import * as shoppingApi from '@/lib/client-api/shopping-list';
import { act, renderHook } from '@/tests/component-render';
import { useSlotMarking } from './use-slot-marking';

// FRESCO-1284 — a mark whose write fails is settled with what the database holds: the response can get lost after the
// write arrived (chaos experiment E2), so reverting blindly made the screen lie.

type Args = Parameters<typeof useSlotMarking>[0];
type Estados = Args['estados'];

const SLOT_IDS = { lunes: { comida: 'slot-1' } } as unknown as Args['slotIds'];
const INITIAL = { lunes: { comida: 'pendiente' } } as unknown as Estados;
const CONFLICT = 'Este plato ya fue marcado. Actualiza la página para ver su estado actual.';
const REFUSED = 'No se pudo guardar el estado del plato. Vuelve a intentarlo.';
const UNKNOWN = 'No hemos podido comprobar si se guardó el estado del plato. Recarga la página.';

let spies: { mockRestore: () => void }[];
let writeSpy: ReturnType<typeof spyOn<typeof edgeFunctions, 'updateRecipeStatus'>>;
let readSpy: ReturnType<typeof spyOn<typeof mealPlanApi, 'getSlotEstado'>>;
let staleSpy: ReturnType<typeof spyOn<typeof shoppingApi, 'listaDesactualizadaDeSlot'>>;
let messages: (string | null)[];
let staleCalls: number;

beforeEach(() => {
  messages = [];
  staleCalls = 0;
  writeSpy = spyOn(edgeFunctions, 'updateRecipeStatus').mockRejectedValue(new TypeError('Failed to fetch'));
  readSpy = spyOn(mealPlanApi, 'getSlotEstado').mockResolvedValue('pendiente');
  staleSpy = spyOn(shoppingApi, 'listaDesactualizadaDeSlot').mockResolvedValue(true);
  spies = [writeSpy, readSpy, staleSpy, spyOn(authApi, 'getAccessToken').mockResolvedValue('token'), spyOn(console, 'error').mockImplementation(() => {})];
});

afterEach(() => { for (const spy of spies) { spy.mockRestore(); } });

// Stable across renders, as the grid's are: a new callback would make the hook flush the pending mark early.
const onMessage = (message: string | null) => { messages.push(message); };
const onStale = () => { staleCalls += 1; };

async function mark(estado: 'cocinada' | 'descartada') {
  const view = renderHook(() => {
    const [estados, setEstados] = React.useState(INITIAL);
    const [pendingSlots, setPendingSlots] = React.useState<ReadonlySet<string>>(new Set<string>());
    const marking = useSlotMarking({ slotIds: SLOT_IDS, estados, setEstados, pendingSlots, setPendingSlots, setErrorMessage: onMessage, onListaDesactualizada: onStale });
    return { estados, ...marking };
  });
  act(() => view.result.current.handleMarkEstado({ dia: 'lunes', tipo: 'comida', estado }));
  // `pagehide` commits the pending mark without waiting for the undo window.
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  });
  return { shown: () => view.result.current.estados.lunes.comida, lastMessage: () => messages.at(-1) };
}

describe('useSlotMarking — a write that fails', () => {
  test('a lost response for a mark that was saved keeps it, with no message', async () => {
    readSpy.mockResolvedValue('descartada');
    const { shown, lastMessage } = await mark('descartada');

    expect(readSpy).toHaveBeenCalledWith('slot-1');
    expect(shown()).toBe('descartada');
    expect(lastMessage()).toBeNull();
    expect(staleCalls).toBe(1);
  });

  test('a retry answered 409 for the same mark is not an error', async () => {
    writeSpy.mockRejectedValue(new edgeFunctions.EdgeFunctionError(409, { error: 'terminal' }));
    readSpy.mockResolvedValue('cocinada');
    const { shown, lastMessage } = await mark('cocinada');

    expect(shown()).toBe('cocinada');
    expect(lastMessage()).toBeNull();
  });

  test('a 409 for a different mark shows what the database holds and says so', async () => {
    writeSpy.mockRejectedValue(new edgeFunctions.EdgeFunctionError(409, { error: 'terminal' }));
    readSpy.mockResolvedValue('descartada');
    const { shown, lastMessage } = await mark('cocinada');

    expect(shown()).toBe('descartada');
    expect(lastMessage()).toBe(CONFLICT);
  });

  test('a write that did not arrive reverts and asks to try again', async () => {
    const { shown, lastMessage } = await mark('cocinada');

    expect(shown()).toBe('pendiente');
    expect(lastMessage()).toBe(REFUSED);
  });

  test('with no answer and no way to read, the mark stays and nothing asks to retry it', async () => {
    readSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const { shown, lastMessage } = await mark('cocinada');

    expect(shown()).toBe('cocinada');
    expect(lastMessage()).toBe(UNKNOWN);
  });

  test('a refusal from the server reverts even if the read fails', async () => {
    writeSpy.mockRejectedValue(new edgeFunctions.EdgeFunctionError(500, { error: 'boom' }));
    readSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const { shown, lastMessage } = await mark('cocinada');

    expect(shown()).toBe('pendiente');
    expect(lastMessage()).toBe(REFUSED);
  });
});
