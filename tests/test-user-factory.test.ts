import { describe, expect, spyOn, test } from 'bun:test';
import { deleteTrackedUsers } from './test-user-factory';

/** FRESCO-1016 (A7-TEST-09): a failed cleanup is reported, not swallowed, and never stops the others. */
describe('deleteTrackedUsers', () => {
  test('deletes every id and reports none failed when all go well', async () => {
    const deleted: string[] = [];

    const failed = await deleteTrackedUsers(['a', 'b', 'c'], async (id) => { deleted.push(id); });

    expect(failed).toEqual([]);
    expect(deleted.sort()).toEqual(['a', 'b', 'c']);
  });

  test('one failure does not stop the rest, and the failed id comes back', async () => {
    const deleted: string[] = [];
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const failed = await deleteTrackedUsers(['a', 'b', 'c'], async (id) => {
        if (id === 'b') { throw new Error('403 forbidden'); }
        deleted.push(id);
      });

      expect(failed).toEqual(['b']);
      expect(deleted.sort()).toEqual(['a', 'c']);
    }
    finally {
      spy.mockRestore();
    }
  });

  test('each failure is annotated for the run page with the id and the reason', async () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      await deleteTrackedUsers(['x'], async () => { throw new Error('boom'); });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).toContain('::error::');
      expect(String(spy.mock.calls[0][0])).toContain('x');
      expect(String(spy.mock.calls[0][0])).toContain('boom');
    }
    finally {
      spy.mockRestore();
    }
  });
});
