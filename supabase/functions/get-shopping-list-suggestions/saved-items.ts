/**
 * Names of the items already on a shopping list. The stored `items` column is jsonb, so a list
 * written before `jsonb_add_item` rejected non-objects (FRESCO-1015) can hold an aisle without an
 * `items` array or an item without a text `nombre`. Those are skipped here instead of failing the
 * whole suggestions request with a 500.
 */
export function savedItemNames(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  return items.flatMap((pasillo) => {
    const inAisle = (pasillo as { items?: unknown } | null)?.items
    if (!Array.isArray(inAisle)) return []
    return inAisle.flatMap((item) => {
      const nombre = (item as { nombre?: unknown } | null)?.nombre
      return typeof nombre === 'string' ? [nombre] : []
    })
  })
}
