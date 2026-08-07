/**
 * Pure, framework-agnostic ISO 8601 week-date helpers (CLAUDE.md §10 — shared
 * utilities stay framework-agnostic, no React/Next APIs).
 *
 * Needed by `generateMealPlan()`'s request contract
 * (`api/schemas/api-contracts.types.ts`'s `GenerateMealPlanRequest.semana_iso`,
 * `'YYYY-WXX'`) and by `meal_plans.semana_iso`'s read path. No ISO-week
 * utility existed anywhere in the repo before this (verified via `rg` for
 * `isoWeek`/`getWeek`/`WXX`).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * ISO 8601 weekday number for `date`, Monday = 1 ... Sunday = 7 (unlike
 * `Date.prototype.getDay()`, which is Sunday = 0 ... Saturday = 6).
 */
function getIsoWeekday(date: Date): number {
  return date.getUTCDay() || 7;
}

/**
 * Normalizes `date` to a UTC midnight `Date` built from its local
 * year/month/day components. Calendar-day arithmetic (adding/subtracting
 * whole days) is only safe to do in UTC — otherwise DST transitions can
 * silently shift the result by a day.
 */
function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Returns `date`'s ISO 8601 week string, `'YYYY-Www'` (e.g. `'2026-W05'`).
 *
 * Per ISO 8601: week 1 is the week containing the year's first Thursday
 * (equivalently, the week containing 4 January), weeks run Monday-Sunday,
 * and a date's *ISO week-year* can differ from its calendar year at the
 * year boundary (e.g. 31 Dec can fall in week 1 of the *next* year, and
 * 1 Jan can fall in week 52/53 of the *previous* year).
 */
export function getIsoWeek(date: Date = new Date()): string {
  const target = toUtcDateOnly(date);
  // Shift to the Thursday of this ISO week — the ISO week-year is always
  // that Thursday's calendar year.
  target.setUTCDate(target.getUTCDate() + 4 - getIsoWeekday(target));

  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((target.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);

  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
}

/**
 * Returns the Monday of `date`'s ISO week, as `'YYYY-MM-DD'`.
 */
export function getIsoWeekMonday(date: Date = new Date()): string {
  const target = toUtcDateOnly(date);
  target.setUTCDate(target.getUTCDate() - getIsoWeekday(target) + 1);
  return target.toISOString().slice(0, 10);
}

/**
 * Inverse of `getIsoWeek()`: given `'YYYY-Www'`, returns the Monday of that
 * ISO week as a UTC `Date`. Per ISO 8601, 4 January is always in week 1, so
 * week 1's Monday anchors every other week in the year by simple 7-day
 * multiples (FRESCO-61 — `/calendar` week navigation needs this to compute
 * the adjacent week's `semana_iso` from the one currently being viewed).
 */
export function getDateFromIsoWeek(isoWeek: string): Date {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!match) {
    throw new Error(`Invalid ISO week string: ${isoWeek}`);
  }

  const [, yearStr, weekStr] = match;
  const isoYear = Number(yearStr);
  const week = Number(weekStr);

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - getIsoWeekday(jan4) + 1);

  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return target;
}

/**
 * Returns the `'YYYY-Www'` string `delta` weeks away from `isoWeek`
 * (negative = earlier, positive = later). Used for the prev/next controls.
 */
export function addIsoWeeks(isoWeek: string, delta: number): string {
  const monday = getDateFromIsoWeek(isoWeek);
  monday.setUTCDate(monday.getUTCDate() + delta * 7);
  return getIsoWeek(monday);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Human-readable Monday-Sunday range label for `/calendar`'s week
 * navigation (e.g. "3–9 feb"). FRESCO-109: a week that crosses a month
 * boundary always used the Sunday's month for both ends ("27–2 ago"),
 * reading as if the 27th were in August — now shown as "27 jul – 2 ago"
 * whenever the two ends fall in different months.
 */
export function formatWeekRangeLabel(mondayIso: string): string {
  const monday = new Date(`${mondayIso}T00:00:00.000Z`);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const mondayMonth = MESES[monday.getUTCMonth()];
  const sundayMonth = MESES[sunday.getUTCMonth()];

  if (mondayMonth === sundayMonth) {
    return `${monday.getUTCDate()}–${sunday.getUTCDate()} ${sundayMonth}`;
  }
  return `${monday.getUTCDate()} ${mondayMonth} – ${sunday.getUTCDate()} ${sundayMonth}`;
}
