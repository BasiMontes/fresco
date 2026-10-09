/**
 * The app is Spain-only: "today" is the calendar date in Madrid, not in the
 * browser's or the server's timezone. Mirrors `hoyEnMadrid` in
 * `supabase/functions/generate-shopping-list/remaining-days.ts` (a Deno
 * module this Next.js code cannot import) and the `Europe/Madrid` cut in the
 * `assign_recipe_to_slot` SQL function, so the UI and the database agree on
 * which days are already behind us.
 */
export function hoyEnMadrid(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** `fecha` (`YYYY-MM-DD`) plus `dias` calendar days, as `YYYY-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const resultado = new Date(`${fecha}T00:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}
