/** Lowercase, trim, collapse whitespace, strip accents — the canonical form ingredient names are compared/keyed by across consolidator.ts and aisle-pricing.ts. */
export function normalizeNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n')
}
