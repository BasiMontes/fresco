// Deno mirror of `lib/date/iso-week.ts`'s `getIsoWeek()` — copied rather
// than imported, because a value (non-type) import reaching outside
// `supabase/functions/` is unverified territory for this project's Edge
// Function bundler (every existing cross-directory import in this tree —
// `types.ts` in `generate-meal-plan`/`reassign-guest-data` — is a type-only
// import, erased at compile time, never resolved by Deno at runtime; this
// function needs the actual algorithm at runtime).
//
// If `lib/date/iso-week.ts`'s algorithm ever changes, this MUST change
// identically — a drift here would silently break AC2/AC4 (whether "this
// user already planned the current week" resolves correctly depends on
// both sides computing byte-for-byte the same `semana_iso` string).
//
// Only `getIsoWeek()` is ported — the other exports there
// (getDateFromIsoWeek, addIsoWeeks, formatWeekRangeLabel) have no use case
// here, per YAGNI.

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * ISO 8601 weekday number for `date`, Monday = 1 ... Sunday = 7 (unlike
 * `Date.prototype.getDay()`, which is Sunday = 0 ... Saturday = 6).
 */
function getIsoWeekday(date: Date): number {
  return date.getUTCDay() || 7
}

/**
 * Normalizes `date` to a UTC midnight `Date` built from its local
 * year/month/day components — calendar-day arithmetic is only safe in UTC.
 */
function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

/**
 * Returns `date`'s ISO 8601 week string, `'YYYY-Www'` (e.g. `'2026-W35'`).
 * Must match `lib/date/iso-week.ts`'s `getIsoWeek()` exactly — see header.
 */
export function getCurrentIsoWeek(date: Date = new Date()): string {
  const target = toUtcDateOnly(date)
  target.setUTCDate(target.getUTCDate() + 4 - getIsoWeekday(target))

  const isoYear = target.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const isoWeek = Math.ceil(((target.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7)

  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`
}
