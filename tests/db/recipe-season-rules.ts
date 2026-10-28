/**
 * FRESCO-1058 — TypeScript twin of the SQL season rule: `compute_recipe_temporada` and
 * `recipe_temporada_problem` (migrations 20261027170000 and 20261027190000).
 *
 * Test-only oracle, like `recipe-allergen-diet-rules.ts`: `recipe-season-parity.test.ts` compares it with the
 * SQL on every recipe of the catalogue, so a change to one copy that misses the other fails there.
 */

/** Calendar order, as the SQL array. `otono` has no ñ on purpose: the stored value is ASCII. */
export const SEASONS = ['primavera', 'verano', 'otono', 'invierno'] as const;

export const ALL_YEAR = 'todo_el_ano';

/** nombre (lower case) -> seasons, the content of `public.ingredient_seasons`. */
export type SeasonTable = ReadonlyMap<string, readonly string[]>;

/**
 * Seasons shared by every seasonal ingredient, in calendar order. `['todo_el_ano']` when no ingredient is
 * seasonal or the input is not an array, `null` when the seasonal ingredients share no season.
 */
export function computeRecipeTemporada(ingredientes: unknown, table: SeasonTable): string[] | null {
  const names = Array.isArray(ingredientes) ? ingredientes : [];
  const seasonal = names
    .filter((name): name is string => typeof name === 'string')
    .map(name => table.get(name.toLowerCase()))
    .filter((seasons): seasons is readonly string[] => seasons !== undefined);

  if (seasonal.length === 0) {
    return [ALL_YEAR];
  }
  const common = SEASONS.filter(season => seasonal.every(seasons => seasons.includes(season)));
  return common.length > 0 ? common : null;
}

/** slug -> season, the content of `public.recipe_season_exceptions` (FRESCO-1059). */
export type SeasonExceptions = ReadonlyMap<string, readonly string[]>;

/** The cold-months season a stew, a soup or a non-light legume dish is wanted in. */
const COLD_MONTHS = ['otono', 'invierno'] as const;

/**
 * Twin of the SQL `compute_recipe_season` (FRESCO-1059): the ingredient season first, then the dish. `null` on a
 * conflict between ingredients passes through (a person decides). For a recipe with no seasonal ingredient the
 * per-slug exception wins, then `guiso` / `sopa` / non-light `legumbres` go to autumn and winter, then all-year.
 */
export function computeRecipeSeason(
  ingredientes: unknown,
  slug: unknown,
  clasificacion: unknown,
  table: SeasonTable,
  exceptions: SeasonExceptions,
): string[] | null {
  const base = computeRecipeTemporada(ingredientes, table);
  if (base === null || base[0] !== ALL_YEAR) {
    return base;
  }

  const exception = typeof slug === 'string' ? exceptions.get(slug) : undefined;
  if (exception !== undefined) {
    return [...exception];
  }

  const info = (typeof clasificacion === 'object' && clasificacion !== null ? clasificacion : {}) as Record<string, unknown>;
  const isStew = info.categoria === 'guiso' || info.categoria === 'sopa';
  const isHeartyLegume = info.categoria === 'legumbres' && info.es_ligero !== true;
  return isStew || isHeartyLegume ? [...COLD_MONTHS] : [ALL_YEAR];
}

/**
 * First problem with a stored season, `null` when it is fine. Same checks in the same order as the SQL
 * `recipe_temporada_problem`; the wording is not the SQL's, parity is on null versus non-null.
 */
export function recipeTemporadaProblem(temporada: unknown, ingredientes: unknown, table: SeasonTable): string | null {
  if (!Array.isArray(temporada) || temporada.length === 0) {
    return 'empty season: must be a list of primavera, verano, otono, invierno or todo_el_ano';
  }
  if (temporada.some(value => typeof value !== 'string')) {
    return 'season with values that are not text';
  }
  const got = temporada as string[];
  const allowed: readonly string[] = SEASONS;

  const onlyAllYear = got.length === 1 && got[0] === ALL_YEAR;
  if (!onlyAllYear) {
    if (got.some(season => !allowed.includes(season))) {
      return 'season with a value that is not allowed (only primavera, verano, otono, invierno; todo_el_ano goes alone)';
    }
    if (new Set(got).size !== got.length) {
      return 'season with repeated values';
    }
    const sorted = [...got].sort((a, b) => allowed.indexOf(a) - allowed.indexOf(b));
    if (sorted.some((season, index) => season !== got[index])) {
      return 'season out of the order primavera, verano, otono, invierno';
    }
  }

  const expected = computeRecipeTemporada(ingredientes, table);
  if (expected !== null && (expected.length !== got.length || expected.some((season, index) => season !== got[index]))) {
    return `season ${JSON.stringify(got)} does not fit its ingredients, which give ${JSON.stringify(expected)} (expected vs stored)`;
  }
  return null;
}
