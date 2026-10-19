// FRESCO-1014 (A7-UI-15) — is a plan the current week's? A mark (cocinada / descartada) may be changed or
// removed only inside the current week, in the same Madrid frame the calendar and the shopping list use.
// `getCurrentIsoWeek` is the Deno mirror kept next to the weekly push (see its header).

import { getCurrentIsoWeek } from '../send-weekly-reengagement-push/iso-week.ts'

/** The ISO week (`YYYY-Www`) it is today in Madrid. */
export function semanaActualMadrid(ahora: Date = new Date()): string {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
  // Noon UTC: the date is already the Madrid one, so no hour of the day can move it to another week.
  return getCurrentIsoWeek(new Date(`${hoy}T12:00:00Z`))
}
