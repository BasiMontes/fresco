import { describe, expect, test } from 'bun:test';
import { PAGE_SIZE, readAllPages } from './read-all-pages';

/** FRESCO-1165: a query read a page at a time, whatever PostgREST's `max_rows` is. */

function source(total: number, { cap = Infinity, failOnCall }: { cap?: number, failOnCall?: number } = {}) {
  const rows = Array.from({ length: total }, (_, i) => i);
  const ranges: Array<[number, number]> = [];
  const page = async (from: number, to: number) => {
    ranges.push([from, to]);
    if (failOnCall === ranges.length) { return { data: null, error: { message: 'db down' } }; }
    return { data: rows.slice(from, Math.min(to, from + cap - 1) + 1), error: null };
  };
  return { page, ranges, rows };
}

describe('readAllPages', () => {
  test('a result shorter than a page is one read and one empty-page confirmation', async () => {
    const { page, ranges, rows } = source(10);

    expect(await readAllPages(page, 'ctx')).toEqual(rows);
    expect(ranges).toEqual([[0, PAGE_SIZE - 1], [10, 10 + PAGE_SIZE - 1]]);
  });

  test('more than one page is all of it, in order, with each page starting where the last ended', async () => {
    const { page, ranges, rows } = source(2500);

    expect(await readAllPages(page, 'ctx')).toEqual(rows);
    expect(ranges.map(([from]) => from)).toEqual([0, 1000, 2000, 2500]);
  });

  test('a result that is an exact multiple of the page ends on the empty page', async () => {
    const { page, ranges } = source(2000);

    expect(await readAllPages(page, 'ctx')).toHaveLength(2000);
    expect(ranges).toHaveLength(3);
  });

  test('a cap lower than the page loses nothing: it stops on an empty page, never on a short one', async () => {
    const { page, rows } = source(1700, { cap: 300 });

    expect(await readAllPages(page, 'ctx')).toEqual(rows);
  });

  test('nothing at all is an empty list', async () => {
    expect(await readAllPages(source(0).page, 'ctx')).toEqual([]);
  });

  test('a null data without an error is an empty page, not a crash', async () => {
    expect(await readAllPages(async () => ({ data: null, error: null }), 'ctx')).toEqual([]);
  });

  test.each([1, 2, 3])('an error on page %i throws with the context and the cause, never a partial list', async (failOnCall) => {
    let caught: unknown;
    try {
      await readAllPages(source(2500, { failOnCall }).page, 'could not list');
    }
    catch (error) {
      caught = error;
    }

    expect((caught as Error).message).toBe('could not list: db down');
    expect((caught as Error & { cause: unknown }).cause).toEqual({ message: 'db down' });
  });

  test('a source that never ends is stopped by the guard instead of looping forever', async () => {
    let caught: unknown;
    try {
      await readAllPages(async () => ({ data: [1], error: null }), 'runaway');
    }
    catch (error) {
      caught = error;
    }

    expect((caught as Error).message).toContain('refusing to go on');
  });
});
