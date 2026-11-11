/**
 * FRESCO-1165 (integral review PAY-N6): reads EVERY row of a query, a page at a time.
 *
 * PostgREST caps one response at `max_rows` (1000 in `supabase/config.toml` and, by default, on the hosted
 * project). A `select` with no range silently returns the first thousand rows and nothing else, so a job that
 * walks "every profile with a subscription" stops seeing the rest as soon as there are more of them.
 *
 * The next page starts where the rows actually returned end (`from += rows.length`), not at a fixed step: if the
 * server's cap is lower than the page asked for, a fixed step would skip the rows between the two. The read
 * stops on an EMPTY page, never on a short one, for the same reason (a capped page is short and not the last).
 * The cost is one extra, cheap request at the end.
 *
 * The caller must make the query deterministic with an `order(...)` on a unique column, or rows can repeat or be
 * missed between pages. Read the whole result BEFORE changing any row the query depends on.
 */

export const PAGE_SIZE = 1000;
/** A runaway guard, not a limit anyone should meet: 1000 pages is a million rows. */
const MAX_PAGES = 1000;

export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null, error: { message: string } | null }>,
  context: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0, pages = 0; pages < MAX_PAGES; pages++) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      throw Object.assign(new Error(`${context}: ${error.message}`), { cause: error });
    }
    const batch = data ?? [];
    if (batch.length === 0) {
      return rows;
    }
    rows.push(...batch);
    from += batch.length;
  }
  throw new Error(`${context}: more than ${MAX_PAGES} pages of ${PAGE_SIZE} rows, refusing to go on`);
}
