/**
 * Canonical form ingredient names are compared and keyed by: lowercase, trim,
 * collapse internal whitespace, strip Spanish accents.
 *
 * This is the single Node-side source. The Edge Functions keep their own copy
 * at `supabase/functions/_shared/normalize.ts` because the Edge bundler does
 * not resolve value imports reaching outside `supabase/functions/` (every
 * existing cross-directory import in that tree is type-only, erased at compile
 * time). `lib/text/runtime-parity.test.ts` runs both against a shared corpus
 * and fails if they diverge — that test is what forces the two copies to stay
 * byte-for-byte equivalent (FRESCO-382 / audit-4 A4-M8).
 */
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
    .replace(/ñ/g, 'n');
}
