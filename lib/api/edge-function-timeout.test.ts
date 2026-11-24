import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import {
  DELETE_ACCOUNT_TIMEOUT_MESSAGE,
  EDGE_FUNCTION_TIMEOUT_MESSAGE,
  edgeFailureMessage,
  EdgeFunctionTimeoutError,
  GENERATION_TIMEOUT_MESSAGE,
  timeoutMsFor,
} from './edge-function-timeout';
import { deleteAccount, EdgeFunctionError, generateMealPlan, updateRecipeStatus } from './edge-functions';

/**
 * FRESCO-1249 — a call to a function that does not answer ends in an error the screen can show, inside the limit.
 * The chaos experiments (FRESCO-1248) found the call hanging until the browser gave up. Fake timers stand in for
 * the wait: no test sleeps 15 or 30 seconds.
 */

const originalFetch = globalThis.fetch;

/** A `fetch` that never answers, and rejects like the real one when its request is aborted. */
function stubSilentFetch() {
  let signal: AbortSignal | undefined;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => new Promise((_resolve, reject) => {
    signal = init?.signal ?? undefined;
    init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  })) as typeof fetch;
  return { signalOf: () => signal };
}

/** The answer arrives with its headers, then the body stalls. Like the real body, it rejects on a signal that is already aborted. */
function stubStalledBodyFetch() {
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
      if (init?.signal?.aborted) {
        abort();
        return;
      }
      init?.signal?.addEventListener('abort', abort);
    }),
  } as Response)) as typeof fetch;
}

function stubFastFetch() {
  let signal: AbortSignal | undefined;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({ ok: true }) } as Response;
  }) as typeof fetch;
  return { signalOf: () => signal };
}

type Settled = { settled: false } | { settled: true, error: unknown };

/** Enough microtask turns for an already-rejected or already-resolved call to report back. */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 20; turn++) {
    await Promise.resolve();
  }
}

/**
 * Whether the call has finished, and how. It gives up after a few microtask turns on purpose: under fake timers a
 * call that never settles (the limit was removed) would otherwise hang the whole run, because the test's own time
 * limit is a timer too. Here it fails with a plain assertion instead.
 */
async function settle(promise: Promise<unknown>): Promise<Settled> {
  const finished = promise.then(
    (): Settled => ({ settled: true, error: undefined }),
    (error: unknown): Settled => ({ settled: true, error }),
  );
  const gaveUp = flush().then((): Settled => ({ settled: false }));
  return Promise.race([finished, gaveUp]);
}

function errorOf(outcome: Settled): unknown {
  return outcome.settled ? outcome.error : undefined;
}

const markRequest = { recipe_id: 'r1', estado: 'cocinado' } as never;
const generateRequest = { semana_iso: '2026-W48', fecha_inicio: '2026-11-23' } as never;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe('the limit of each call', () => {
  test('a small call gives up after 15 seconds with a timeout error', async () => {
    stubSilentFetch();
    const call = updateRecipeStatus(markRequest, 'token');

    jest.advanceTimersByTime(14_999);
    expect((await settle(call)).settled).toBe(false);
    jest.advanceTimersByTime(1);
    const outcome = await settle(call);

    expect(outcome.settled).toBe(true);
    expect(errorOf(outcome)).toBeInstanceOf(EdgeFunctionTimeoutError);
    expect((errorOf(outcome) as EdgeFunctionTimeoutError).functionName).toBe('update-recipe-status');
    expect((errorOf(outcome) as EdgeFunctionTimeoutError).timeoutMs).toBe(15_000);
  });

  test('a generation is given 30 seconds, not 15', async () => {
    stubSilentFetch();
    const call = generateMealPlan(generateRequest, 'token');

    jest.advanceTimersByTime(15_000);
    expect((await settle(call)).settled).toBe(false);

    jest.advanceTimersByTime(15_000);
    const outcome = await settle(call);
    expect(outcome.settled).toBe(true);
    expect(errorOf(outcome)).toBeInstanceOf(EdgeFunctionTimeoutError);
    expect((errorOf(outcome) as EdgeFunctionTimeoutError).timeoutMs).toBe(30_000);
  });

  test('deleting the account is given 30 seconds too: it ends Stripe billing and erases the person elsewhere first', async () => {
    stubSilentFetch();
    const call = deleteAccount('token', undefined);

    jest.advanceTimersByTime(15_000);
    expect((await settle(call)).settled).toBe(false);
    jest.advanceTimersByTime(15_000);
    const outcome = await settle(call);

    expect(outcome.settled).toBe(true);
    expect(errorOf(outcome)).toBeInstanceOf(EdgeFunctionTimeoutError);
    expect((errorOf(outcome) as EdgeFunctionTimeoutError).timeoutMs).toBe(30_000);
  });

  test('a body that stalls after the headers is still inside the limit', async () => {
    stubStalledBodyFetch();
    const call = updateRecipeStatus(markRequest, 'token');
    // Let the headers arrive and the body read start before the clock moves.
    await flush();

    jest.advanceTimersByTime(15_000);
    const outcome = await settle(call);

    expect(outcome.settled).toBe(true);
    expect(errorOf(outcome)).toBeInstanceOf(EdgeFunctionTimeoutError);
  });

  test('the request is really aborted, not just abandoned', async () => {
    const { signalOf } = stubSilentFetch();
    const call = updateRecipeStatus(markRequest, 'token');
    expect(signalOf()?.aborted).toBe(false);

    jest.advanceTimersByTime(15_000);
    await settle(call);

    expect(signalOf()?.aborted).toBe(true);
  });
});

describe('a call that answers in time', () => {
  test('resolves and is never aborted afterwards: the timer is cleared', async () => {
    const { signalOf } = stubFastFetch();

    const outcome = await settle(updateRecipeStatus(markRequest, 'token'));
    jest.advanceTimersByTime(60_000);

    expect(outcome).toEqual({ settled: true, error: undefined });
    expect(signalOf()?.aborted).toBe(false);
  });

  test('an HTTP error keeps being an EdgeFunctionError, not a timeout', async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 409, statusText: 'Conflict', json: async () => ({ error: 'ya existe' }) } as Response)) as unknown as typeof fetch;

    const error = errorOf(await settle(generateMealPlan(generateRequest, 'token')));

    expect(error).toBeInstanceOf(EdgeFunctionError);
    expect((error as EdgeFunctionError).status).toBe(409);
  });

  test('a network failure keeps being the plain error fetch threw', async () => {
    globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;

    const error = errorOf(await settle(updateRecipeStatus(markRequest, 'token')));

    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(EdgeFunctionTimeoutError);
  });
});

describe('timeoutMsFor and the messages', () => {
  test('has a limit for every function and a larger one only where the work is larger', () => {
    expect(timeoutMsFor('generate-meal-plan')).toBe(30_000);
    expect(timeoutMsFor('delete-account')).toBe(30_000);
    expect(timeoutMsFor('generate-shopping-list')).toBe(15_000);
    expect(timeoutMsFor('anything-new')).toBe(15_000);
  });

  test('edgeFailureMessage swaps in the shared wording only for a timeout', () => {
    expect(edgeFailureMessage(new EdgeFunctionTimeoutError('x', 1), 'propio')).toBe(EDGE_FUNCTION_TIMEOUT_MESSAGE);
    expect(edgeFailureMessage(new TypeError('x'), 'propio')).toBe('propio');
    expect(edgeFailureMessage(undefined, 'propio')).toBe('propio');
  });

  test('a timed-out generation says it may exist, and a timed-out deletion never says to retry', () => {
    expect(GENERATION_TIMEOUT_MESSAGE).toContain('Puede que ya se haya generado');
    expect(DELETE_ACCOUNT_TIMEOUT_MESSAGE).toContain('Inicia sesión');
    expect(DELETE_ACCOUNT_TIMEOUT_MESSAGE.toLowerCase()).not.toContain('inténtalo');
    expect(DELETE_ACCOUNT_TIMEOUT_MESSAGE.toLowerCase()).not.toContain('reintent');
  });
});
