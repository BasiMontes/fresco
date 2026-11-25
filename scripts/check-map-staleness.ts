#!/usr/bin/env bun
/**
 * Business-map staleness warning: `bun run context:stale`.
 *
 * FRESCO-1292 (audit 11 F6, rest of A10-F4). The three business maps are a synthesis an AI wrote on a given
 * day (`business-context-maps.md` §5 checks them section by section, by hand). Audit 10 found the API and the
 * feature maps behind the code and audit 11 found the data map 24 migrations behind, and nothing said so. This
 * script says it in one screen: for each map it compares the date the map was last brought up to date with
 * what the map DESCRIBES (migrations for the data map, routes and Edge Functions for the API map, pages and
 * Edge Functions for the feature map) and prints a warning when that is newer.
 *
 * A WARNING, never a blocker: by default the exit code is 0, it is not part of `repo:check` (the CI checkout
 * there is shallow, so `git log --since` would warn on every PR), and the migrations stay the source of truth
 * (`stack.database.schema_source: migrations`). An audit pass reads it as a notice (`.context/audits/audit-process.md`
 * §7). The weekly workflow `.github/workflows/map-staleness.yml` passes `--fail-on-stale`, so a stale map turns
 * that scheduled run red and opens ONE issue; no pull request is ever affected. Refreshing a map is
 * `project-context mode <data|features|api>` in UPDATE mode, which shows a section-level diff and waits for approval.
 *
 * The map's date is the newest `data-updated` of its sections: a map edited section by section stays as new
 * as its newest section, and the per-section check of §5 is what finds the others.
 *
 * This script is project-owned, `bun run up` does not overwrite it.
 */

import type { ContextMapSkill } from '../cli/lib/context-maps.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import process from 'node:process';

import pc from 'picocolors';
import { CONTEXT_MAP_SKILLS, isPlaceholderMap, mapRelPath } from '../cli/lib/context-maps.ts';
import { parseMap } from './context-map.ts';

type Level = 'ok' | 'warn' | 'info';

export interface Finding {
  level: Level
  text: string
}

/** What a map describes, by kind: a folder of migration files (dated by name) or a path whose git history dates it. */
interface Described {
  label: string
  path: string
  kind: 'migrations' | 'git'
}

const MIGRATIONS_DIR = 'supabase/migrations';

/** The areas each map is a synthesis of. A new map skill without an entry here is reported, never skipped. */
export const DESCRIBES: Readonly<Record<string, readonly Described[]>> = {
  'business-data-context': [{ label: 'migrations', path: MIGRATIONS_DIR, kind: 'migrations' }],
  'business-api-context': [
    { label: 'API routes', path: 'app/api', kind: 'git' },
    { label: 'Edge Functions', path: 'supabase/functions', kind: 'git' },
  ],
  'business-feature-context': [
    { label: 'pages and routes', path: 'app', kind: 'git' },
    { label: 'Edge Functions', path: 'supabase/functions', kind: 'git' },
  ],
};

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in check-map-staleness.test.ts)
// ---------------------------------------------------------------------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The newest valid `data-updated` of a map. `null` when no section carries one. */
export function mapDateOf(sections: ReadonlyArray<{ updated: string | null }>): string | null {
  const days = sections.flatMap(section => (section.updated !== null && ISO_DAY.test(section.updated) ? [section.updated] : []));
  return days.length === 0 ? null : days.reduce((newest, day) => (day > newest ? day : newest));
}

/** The creation day of a migration, from the 14 digits before the first underscore of its name. */
export function migrationDate(path: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})\d{6}_.+\.sql$/.exec(path.split('/').pop() ?? '');
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** File names of the migrations created on a day AFTER the map's day, oldest first. The map's own day is not newer. */
export function migrationsNewerThan(files: readonly string[], mapDate: string): string[] {
  return files
    .filter((file) => {
      const day = migrationDate(file);
      return day !== null && day > mapDate;
    })
    .map(file => file.split('/').pop() ?? file)
    .sort();
}

/** Sections that carry no valid `data-updated`: `unknown`, never silently fresh (`business-context-maps.md` §5). */
export function undatedSections(sections: ReadonlyArray<{ id: string, updated: string | null }>): string[] {
  return sections.filter(section => section.updated === null || !ISO_DAY.test(section.updated)).map(section => section.id);
}

interface MapInput {
  skill: ContextMapSkill
  /** Newest `data-updated` of the map, or null when no section has one. */
  mapDate: string | null
  undated: readonly string[]
  /** Every file name under the migrations folder. */
  migrationFiles: readonly string[]
  /** Commit days (`YYYY-MM-DD`, newest first) that touched `path` after the map's day; `null` when git could not be read. */
  commitDaysSince: (path: string, mapDate: string) => string[] | null
}

/** The findings for one generated map. */
export function checkMap(input: MapInput): Finding[] {
  const { skill, mapDate } = input;
  const describes = DESCRIBES[skill.slug];
  if (!describes) {
    return [{ level: 'info', text: `no description of what ${skill.slug} covers is registered in DESCRIBES (scripts/check-map-staleness.ts): its staleness was NOT checked` }];
  }
  if (mapDate === null) {
    return [{ level: 'warn', text: `no section carries a data-updated date, so the map's age is unknown; run ${skill.generator} in UPDATE mode` }];
  }
  const findings: Finding[] = [];
  for (const area of describes) {
    if (area.kind === 'migrations') {
      const newer = migrationsNewerThan(input.migrationFiles, mapDate);
      findings.push(newer.length === 0
        ? { level: 'ok', text: `${area.label}: none newer than the map (${mapDate})` }
        : { level: 'warn', text: `${area.label}: ${newer.length} newer than the map (${mapDate}), newest ${newer[newer.length - 1]}` });
    }
    else {
      const days = input.commitDaysSince(area.path, mapDate);
      if (days === null) {
        findings.push({ level: 'warn', text: `${area.label} (${area.path}/): git history could not be read, so this was NOT checked` });
        continue;
      }
      findings.push(days.length === 0
        ? { level: 'ok', text: `${area.label} (${area.path}/): no commit after the map (${mapDate})` }
        : { level: 'warn', text: `${area.label} (${area.path}/): ${days.length} commit(s) after the map (${mapDate}), newest ${days[0]}` });
    }
  }
  if (input.undated.length > 0) {
    findings.push({ level: 'warn', text: `${input.undated.length} section(s) have no valid data-updated date, so they are unknown, not fresh: ${input.undated.slice(0, 5).join(', ')}${input.undated.length > 5 ? ', ...' : ''}` });
  }
  return findings;
}

/** 0 unless the caller asked for a failing exit (the weekly workflow) AND something is stale. */
export function exitCodeFor(warned: number, failOnStale: boolean): number {
  return failOnStale && warned > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Host access
// ---------------------------------------------------------------------------

/** Commit days that touched `path` after the end of `mapDate`, newest first. `null` when git fails: "could not tell" is not "none". */
function gitCommitDaysSince(root: string, path: string, mapDate: string): string[] | null {
  const result = Bun.spawnSync(['git', 'log', `--since=${mapDate} 23:59:59`, '--format=%cs', '--', path], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) { return null; }
  return result.stdout.toString().split('\n').map(line => line.trim()).filter(Boolean);
}

function main(): number {
  const root = join(import.meta.dir, '..');
  console.log(pc.bold('\nBusiness maps: staleness (a warning, never a failure)'));
  console.log('='.repeat(56));

  const migrationsDir = join(root, MIGRATIONS_DIR);
  const migrationFiles = existsSync(migrationsDir) ? readdirSync(migrationsDir).filter(file => file.endsWith('.sql')) : [];
  let warned = 0;

  for (const skill of CONTEXT_MAP_SKILLS) {
    const rel = mapRelPath(skill);
    const abs = join(root, rel);
    console.log(`\n${pc.bold(skill.slug)}`);
    if (!existsSync(abs)) {
      console.log(`  ${pc.yellow('!')} no map at ${rel}: run ${skill.generator}`);
      warned++;
      continue;
    }
    const html = readFileSync(abs, 'utf8');
    if (isPlaceholderMap(html)) {
      console.log(`  ${pc.yellow('!')} placeholder map: run ${skill.generator}`);
      warned++;
      continue;
    }
    const { sections } = parseMap(html);
    const findings = checkMap({
      skill,
      mapDate: mapDateOf(sections),
      undated: undatedSections(sections),
      migrationFiles,
      commitDaysSince: (path, mapDate) => gitCommitDaysSince(root, path, mapDate),
    });
    for (const finding of findings) {
      const mark = finding.level === 'ok' ? pc.green('✔') : finding.level === 'warn' ? pc.yellow('!') : pc.dim('·');
      console.log(`  ${mark} ${finding.text}`);
      if (finding.level === 'warn') { warned++; }
    }
    if (findings.some(finding => finding.level === 'warn')) {
      console.log(`  ${pc.dim(`refresh: ${skill.generator}, UPDATE mode (section-level diff, waits for approval)`)}`);
    }
  }

  console.log(warned === 0
    ? `\n${pc.green('✔')} every map is at least as new as what it describes.`
    : `\n${pc.yellow('!')} ${warned} warning(s). This is a notice, not a failure: the migrations stay the source of truth.`);
  return exitCodeFor(warned, process.argv.includes('--fail-on-stale'));
}

if (import.meta.main) {
  process.exit(main());
}
