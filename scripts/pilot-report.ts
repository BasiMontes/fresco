import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/**
 * FRESCO-1032: weekly pilot report, by pseudonym and ISO week, straight from the database.
 *
 *   bunx varlock run -- bun scripts/pilot-report.ts --map <file outside the repo> [--from 2026-W44] [--to 2026-W47]
 *
 * The map file is JSON `{ "P01": "<auth user id>", ... }`. It stays outside the repository; the script
 * fails when it is missing. Output holds pseudonyms only: no emails, names or ids. Read only (select).
 *
 * Definitions (FRESCO-1030, fixed before the pilot starts):
 *   - active in a week: generated a menu, marked at least one dish, or generated the shopping list;
 *   - repeats: active in 3 ISO weeks in a row.
 * A week is attributed by the date of the event: `meal_plans.created_at` for a menu,
 * `meal_plan_recipes.updated_at` for a mark (a mark is a row in cocinada/descartada; a later edit of the
 * same row, such as a rating, moves it to the week of that edit), `shopping_lists.created_at` for a list.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const REPEAT_WEEKS = 3;

/** ISO 8601 week of a date, UTC, as `YYYY-Www`. */
export function isoWeekOf(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Whole weeks since a fixed Monday, so two ISO weeks are consecutive when their indexes differ by 1 (also across years). */
export function weekIndex(isoWeek: string): number {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!match) {
    throw new Error(`Not an ISO week: ${isoWeek}`);
  }
  const jan4 = new Date(Date.UTC(Number(match[1]), 0, 4));
  const monday = jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * DAY_MS + (Number(match[2]) - 1) * 7 * DAY_MS;
  return Math.round((monday - Date.UTC(1970, 0, 5)) / (7 * DAY_MS));
}

export function weeksBetween(from: string, to: string): string[] {
  const weeks: string[] = [];
  for (let index = weekIndex(from); index <= weekIndex(to); index++) {
    weeks.push(isoWeekOf(new Date(Date.UTC(1970, 0, 5) + index * 7 * DAY_MS)));
  }
  return weeks;
}

export interface WeekActivity {
  menus: number
  cooked: number
  discarded: number
  generatedList: boolean
}

export const isActive = (a: WeekActivity): boolean => a.menus > 0 || a.cooked + a.discarded > 0 || a.generatedList;

/** Weeks in a row, ending at each week, counting only active weeks. `weeks` is sorted ascending and consecutive. */
export function streaks(active: boolean[]): number[] {
  const out: number[] = [];
  for (const [i, isOn] of active.entries()) {
    out.push(isOn ? (out[i - 1] ?? 0) + 1 : 0);
  }
  return out;
}

/** Repeats: active on `REPEAT_WEEKS` ISO weeks in a row, whatever weeks those are. */
export const repeats = (active: boolean[]): boolean => streaks(active).some(n => n >= REPEAT_WEEKS);

export interface Activity {
  week: string
  kind: 'menu' | 'cocinada' | 'descartada' | 'list'
}

export interface ReportRow extends WeekActivity {
  pseudonym: string
  week: string
  active: boolean
  streak: number
}

/** One row per pseudonym and week from `from` to `to`, so a quiet week between two active ones shows as a gap. */
export function buildRows(byPseudonym: Record<string, Activity[]>, from: string, to: string): ReportRow[] {
  const weeks = weeksBetween(from, to);
  const rows: ReportRow[] = [];
  for (const pseudonym of Object.keys(byPseudonym).sort()) {
    const events = byPseudonym[pseudonym];
    const perWeek = weeks.map((week): WeekActivity => {
      const inWeek = events.filter(event => event.week === week);
      return {
        menus: inWeek.filter(e => e.kind === 'menu').length,
        cooked: inWeek.filter(e => e.kind === 'cocinada').length,
        discarded: inWeek.filter(e => e.kind === 'descartada').length,
        generatedList: inWeek.some(e => e.kind === 'list'),
      };
    });
    const run = streaks(perWeek.map(isActive));
    for (const [i, week] of weeks.entries()) {
      rows.push({ pseudonym, week, ...perWeek[i], active: isActive(perWeek[i]), streak: run[i] });
    }
  }
  return rows;
}

export function parsePseudonymMap(text: string): Record<string, string> | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  }
  catch {
    return 'The pseudonym file is not valid JSON.';
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return 'The pseudonym file must be an object { "P01": "<user id>" }.';
  }
  const entries = Object.entries(parsed);
  if (entries.length === 0 || entries.some(([, id]) => typeof id !== 'string' || id.length === 0)) {
    return 'Every pseudonym needs a non-empty user id.';
  }
  return Object.fromEntries(entries as [string, string][]);
}

function format(rows: ReportRow[]): string {
  const header = ['week', 'who', 'menus', 'marked', 'cooked', 'discarded', 'list', 'active', 'streak'];
  const lines = rows.map(r => [r.week, r.pseudonym, r.menus, r.cooked + r.discarded, r.cooked, r.discarded, r.generatedList ? 'yes' : 'no', r.active ? 'yes' : 'no', r.streak].map(String));
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map(l => l[i].length)));
  const render = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [render(header), ...lines.map(render)].join('\n');
}

function option(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const mapPath = option(argv, '--map');
  if (!mapPath || !existsSync(mapPath)) {
    console.error('Pass --map <path to the pseudonym file>. It must exist and live outside the repository.');
    return 2;
  }
  const map = parsePseudonymMap(readFileSync(mapPath, 'utf8'));
  if (typeof map === 'string') {
    console.error(map);
    return 2;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run through varlock).');
    return 2;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const pseudonymOf = new Map(Object.entries(map).map(([p, id]) => [id, p]));
  const ids = [...pseudonymOf.keys()];

  const [plans, lists] = await Promise.all([
    supabase.from('meal_plans').select('id, user_id, created_at').in('user_id', ids).range(0, 9999),
    supabase.from('shopping_lists').select('user_id, created_at').in('user_id', ids).range(0, 9999),
  ]);
  if (plans.error || lists.error) {
    console.error(`Read failed: ${plans.error?.message ?? lists.error?.message}`);
    return 1;
  }
  const planIds = plans.data.map(p => p.id);
  const slots = planIds.length === 0
    ? { data: [], error: null }
    : await supabase.from('meal_plan_recipes').select('meal_plan_id, estado, updated_at').in('meal_plan_id', planIds).in('estado', ['cocinada', 'descartada']).range(0, 9999);
  if (slots.error) {
    console.error(`Read failed: ${slots.error.message}`);
    return 1;
  }

  const owner = new Map(plans.data.map(p => [p.id, pseudonymOf.get(p.user_id) ?? '']));
  const byPseudonym: Record<string, Activity[]> = Object.fromEntries(Object.keys(map).map(p => [p, []]));
  for (const plan of plans.data) {
    byPseudonym[pseudonymOf.get(plan.user_id) ?? '']?.push({ week: isoWeekOf(new Date(plan.created_at)), kind: 'menu' });
  }
  for (const slot of slots.data) {
    byPseudonym[owner.get(slot.meal_plan_id) ?? '']?.push({ week: isoWeekOf(new Date(slot.updated_at)), kind: slot.estado === 'cocinada' ? 'cocinada' : 'descartada' });
  }
  for (const list of lists.data) {
    byPseudonym[pseudonymOf.get(list.user_id) ?? '']?.push({ week: isoWeekOf(new Date(list.created_at)), kind: 'list' });
  }

  const weeks = Object.values(byPseudonym).flat().map(e => e.week).sort();
  const from = option(argv, '--from') ?? weeks[0];
  const to = option(argv, '--to') ?? isoWeekOf(new Date());
  if (!from) {
    console.log('No activity for any pseudonym yet.');
    return 0;
  }
  const rows = buildRows(byPseudonym, from, to);
  console.log(format(rows));
  const repeaters = Object.keys(byPseudonym).filter(p => repeats(rows.filter(r => r.pseudonym === p).map(r => r.active)));
  console.log(`\nRepeat (${REPEAT_WEEKS} weeks in a row): ${repeaters.length} of ${Object.keys(map).length}${repeaters.length ? ` (${repeaters.join(', ')})` : ''}`);
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
