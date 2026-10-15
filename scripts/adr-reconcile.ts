#!/usr/bin/env bun
/**
 * adr-reconcile.ts — FRESCO-958
 *
 * `bun sync` delivers the boilerplate's own numbered ADRs into
 * `.context/ADR/` with upstream's numbers, which this project already uses for
 * its own decisions (`adr:check` then fails on duplicate numbers and on files
 * missing from the README index). The updater only keeps them out of an
 * ADOPTED app, and flipping that mode here swaps the pre-push gates for ones
 * that fail on the synced `cli/`. This script does by rule what was done by
 * hand once: run it right after a sync.
 *
 * An incoming ADR is a file in `.context/ADR/` that the README index does not
 * list. For each one:
 *   - the same slug is already indexed: it is a copy of a decision we hold
 *     (maybe under another number), so it is dropped; a note says whether the
 *     imported text still differs from ours;
 *   - otherwise it is new: when its number is taken it moves to the next free
 *     one, the title and every citation to a renumbered ADR are rewritten, an
 *     `Upstream number` line is added, and a row goes into the README index.
 * The README keeps a table upstream number -> ours between two markers, which is
 * how a synced file that cites an upstream number is resolved.
 *
 * Default is a dry run; `--yes` writes. Usage:
 *   bun scripts/adr-reconcile.ts [--yes]
 * Then run `bun run adr:check`.
 */

import type { AdrFile } from './check-adrs';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { statusWord } from './check-adrs';

export const MAP_START = '<!-- upstream-adr-map:start -->';
export const MAP_END = '<!-- upstream-adr-map:end -->';

const FILE_RE = /^ADR-(\d{4})-(.+)\.md$/;
const INDEX_ROW_RE = /^\|\s*\[ADR-(\d{4})\]\(\.\/(ADR-\d{4}-[^)]+\.md)\)/;
const MAP_ROW_RE = /^\|\s*ADR-(\d{4})\s*\|\s*\[ADR-(\d{4})\]/;
const UPSTREAM_LINE_RE = /^- \*\*Upstream number:\*\*\s*ADR-(\d{4})/m;
const CITATION_RE = /\bADR-(\d{4})\b/g;
const HEADER_FIELDS = ['- **Superseded by:**', '- **Supersedes:**', '- **Tags:**', '- **Status:**'];

export interface DropAction {
  name: string
  keptAs: string
  /** The imported text, once renumbered, is not the text we already hold. */
  differs: boolean
}

export interface AddAction {
  from: string
  to: string
  upstream: string
  renumbered: boolean
  content: string
}

export interface Plan {
  drops: DropAction[]
  adds: AddAction[]
  warnings: string[]
  readme: string
}

const pad = (n: number): string => String(n).padStart(4, '0');
const slugOf = (name: string): string => FILE_RE.exec(name)?.[2] ?? name;
const numberOf = (name: string): string => FILE_RE.exec(name)?.[1] ?? '';

/** Names the README index links. */
function indexedNames(readme: string): Set<string> {
  const names = new Set<string>();
  for (const line of readme.split('\n')) {
    const name = INDEX_ROW_RE.exec(line)?.[2];
    if (name) { names.add(name); }
  }
  return names;
}

/** Upstream number -> our number, from the README table and from `Upstream number` lines. */
function persistedMap(readme: string, indexed: AdrFile[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of readme.split('\n')) {
    const row = MAP_ROW_RE.exec(line);
    if (row) { map.set(row[1], row[2]); }
  }
  for (const file of indexed) {
    const upstream = UPSTREAM_LINE_RE.exec(file.content)?.[1];
    if (upstream) { map.set(upstream, numberOf(file.name)); }
  }
  return map;
}

/** Rewrite every `ADR-NNNN` that the map knows; report the ones it does not. */
function rewriteCitations(content: string, map: Map<string, string>, unmapped: Set<string>): string {
  return content.replace(CITATION_RE, (whole, number: string) => {
    const mapped = map.get(number);
    if (mapped === undefined) {
      unmapped.add(number);
      return whole;
    }
    return `ADR-${mapped}`;
  });
}

function withUpstreamLine(content: string, upstream: string): string {
  if (UPSTREAM_LINE_RE.test(content)) { return content; }
  const line = `- **Upstream number:** ADR-${upstream} (renumbered on import because this project already used that number; synced files cite the upstream number)`;
  const lines = content.split('\n');
  for (const field of HEADER_FIELDS) {
    const at = lines.findIndex(l => l.startsWith(field));
    if (at !== -1) {
      lines.splice(at + 1, 0, line);
      return lines.join('\n');
    }
  }
  lines.splice(1, 0, '', line);
  return lines.join('\n');
}

function citedNumbers(line: string | undefined): string {
  const found = [...new Set(line?.match(CITATION_RE) ?? [])];
  return found.length > 0 ? found.join(', ') : '—';
}

function fieldLine(content: string, field: string): string | undefined {
  return content.split('\n').find(l => l.startsWith(`- **${field}:**`));
}

function indexRow(add: AddAction): string {
  const title = /^# ADR-\d{4}[ \t]*[—-][ \t]*(\S.*)$/m.exec(add.content)?.[1] ?? slugOf(add.to);
  const status = statusWord(add.content) ?? 'Proposed';
  const number = numberOf(add.to);
  return `| [ADR-${number}](./${add.to}) | ${title.replace(/\|/g, '\\|')} | ${status} | ${citedNumbers(fieldLine(add.content, 'Supersedes'))} | ${citedNumbers(fieldLine(add.content, 'Superseded by'))} |`;
}

function insertRows(readme: string, adds: AddAction[]): string {
  const lines = readme.split('\n');
  for (const add of [...adds].sort((a, b) => a.to.localeCompare(b.to))) {
    const number = numberOf(add.to);
    let after = -1;
    let first = -1;
    lines.forEach((line, i) => {
      const n = INDEX_ROW_RE.exec(line)?.[1];
      if (n === undefined) { return; }
      if (first === -1) { first = i; }
      if (n < number) { after = i; }
    });
    const at = after !== -1 ? after + 1 : (first !== -1 ? first : lines.length);
    lines.splice(at, 0, indexRow(add));
  }
  return lines.join('\n');
}

function mapTable(map: Map<string, string>, fileByNumber: Map<string, string>): string {
  const rows = [...map.entries()]
    .filter(([upstream, ours]) => upstream !== ours)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([upstream, ours]) => `| ADR-${upstream} | [ADR-${ours}](./${fileByNumber.get(ours) ?? `ADR-${ours}.md`}) |`);
  return ['| Upstream | Ours |', '| --- | --- |', ...rows].join('\n');
}

function withMap(readme: string, map: Map<string, string>, fileByNumber: Map<string, string>): string | null {
  const start = readme.indexOf(MAP_START);
  const end = readme.indexOf(MAP_END);
  if (start === -1 || end === -1 || end < start) { return null; }
  return `${readme.slice(0, start + MAP_START.length)}\n\n${mapTable(map, fileByNumber)}\n\n${readme.slice(end)}`;
}

/** Decide what to do with every ADR file the README index does not list. */
export function planReconcile(files: AdrFile[], readme: string): Plan {
  const names = indexedNames(readme);
  const indexed = files.filter(f => names.has(f.name));
  const incoming = files
    .filter(f => FILE_RE.test(f.name) && !names.has(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const warnings: string[] = [];

  const map = persistedMap(readme, indexed);
  const used = new Set(indexed.map(f => numberOf(f.name)));
  const target = new Map<string, { to: string, existing?: AdrFile }>();

  for (const file of incoming) {
    const upstream = numberOf(file.name);
    const existing = indexed.find(f => slugOf(f.name) === slugOf(file.name));
    if (existing) {
      map.set(upstream, numberOf(existing.name));
      target.set(file.name, { to: existing.name, existing });
      continue;
    }
    const taken = used.has(upstream);
    const ours = taken ? pad(Math.max(...[...used].map(Number), 0) + 1) : upstream;
    used.add(ours);
    map.set(upstream, ours);
    target.set(file.name, { to: `ADR-${ours}-${slugOf(file.name)}.md` });
  }

  const drops: DropAction[] = [];
  const adds: AddAction[] = [];
  for (const file of incoming) {
    const upstream = numberOf(file.name);
    const { to, existing } = target.get(file.name)!;
    const unmapped = new Set<string>();
    let content = rewriteCitations(file.content, map, unmapped);
    if (numberOf(to) !== upstream) { content = withUpstreamLine(content, upstream); }
    for (const number of unmapped) {
      warnings.push(`${file.name} cites ADR-${number}, which has no mapping; it resolves to our ADR-${number}`);
    }
    if (existing) {
      drops.push({ name: file.name, keptAs: existing.name, differs: content !== existing.content });
    }
    else {
      adds.push({ from: file.name, to, upstream, renumbered: numberOf(to) !== upstream, content });
    }
  }

  const fileByNumber = new Map([...indexed.map(f => f.name), ...adds.map(a => a.to)].map(name => [numberOf(name), name]));
  let next = insertRows(readme, adds);
  const mapped = withMap(next, map, fileByNumber);
  if (mapped === null) {
    if (incoming.length > 0) { warnings.push(`README.md has no ${MAP_START} / ${MAP_END} markers: the upstream number table was not updated`); }
  }
  else { next = mapped; }

  return { drops, adds, warnings, readme: next };
}

function readAdrDir(dir: string): { files: AdrFile[], readme: string } {
  const files = readdirSync(dir)
    .filter(name => FILE_RE.test(name))
    .map(name => ({ name, content: readFileSync(join(dir, name), 'utf8') }));
  return { files, readme: readFileSync(join(dir, 'README.md'), 'utf8') };
}

export function applyPlan(dir: string, plan: Plan): void {
  for (const drop of plan.drops) { rmSync(join(dir, drop.name)); }
  for (const add of plan.adds) {
    if (add.from !== add.to) { rmSync(join(dir, add.from)); }
    writeFileSync(join(dir, add.to), add.content);
  }
  writeFileSync(join(dir, 'README.md'), plan.readme);
}

function main(): void {
  const dir = join(import.meta.dir, '..', '.context', 'ADR');
  const write = process.argv.includes('--yes');
  const { files, readme } = readAdrDir(dir);
  const plan = planReconcile(files, readme);

  const mapRefreshed = plan.readme !== readme;
  if (plan.drops.length === 0 && plan.adds.length === 0 && !mapRefreshed) {
    console.log('adr-reconcile: nothing to do, every ADR file is in the README index.');
    return;
  }
  if (mapRefreshed && plan.drops.length === 0 && plan.adds.length === 0) {
    console.log('map   the upstream number table in README.md is out of date');
  }
  for (const drop of plan.drops) {
    const note = drop.differs ? 'the imported text differs from ours, compare it with upstream' : 'same text';
    console.log(`drop  ${drop.name}  (already ours as ${drop.keptAs}; ${note})`);
  }
  for (const add of plan.adds) {
    const how = add.renumbered ? `renumbered, Upstream number ADR-${add.upstream}` : 'number kept';
    console.log(`add   ${add.from}${add.renumbered ? `  ->  ${add.to}` : ''}  (${how})`);
  }
  for (const warning of plan.warnings) { console.warn(`warn  ${warning}`); }

  if (!write) {
    console.log('adr-reconcile: dry run, nothing written. Pass --yes to apply.');
    return;
  }
  applyPlan(dir, plan);
  console.log('adr-reconcile: applied. Next: bun run adr:check');
}

if (import.meta.main) { main(); }
