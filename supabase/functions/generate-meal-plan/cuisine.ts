// FRESCO-1226: favourite cuisines as the softest menu signal (FR-5.4, signal 7: "prefer, never force").
//
// Two vocabularies meet here. The user picks from `TipoCocina` (`española`, `mediterránea`, `latina`, ...), but
// the live catalog stores `clasificacion.cocina` as free text with accent variants and its own names
// (`mediterranea` next to `mediterránea`, `latinoamericana`, `casera`). Both sides are folded to one key so
// "mediterránea" matches "mediterranea". A catalog cuisine with no user-facing equivalent (`casera`) simply
// matches nothing: it is never guessed into a cuisine the user did not pick.

const CATALOG_ALIASES: Record<string, string> = {
  latinoamericana: 'latina',
}

/** Lowercase, accent-free, aliased key for a cuisine name from either vocabulary. */
export function cuisineKey(name: unknown): string {
  const folded = (typeof name === 'string' ? name : '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  return CATALOG_ALIASES[folded] ?? folded
}

/**
 * The set of cuisine keys a profile prefers. Empty for anything that is not a list (null, undefined, a stray
 * string); non-string entries are skipped. Never throws: a throw here would 500 menu generation.
 */
export function favouriteCuisineKeys(cocinasFavoritas: unknown): Set<string> {
  if (!Array.isArray(cocinasFavoritas)) return new Set()
  return new Set(
    cocinasFavoritas
      .filter((name): name is string => typeof name === 'string')
      .map(cuisineKey)
      .filter(key => key !== ''),
  )
}
