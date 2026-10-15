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
 * FRESCO-962: the documents `docs:check` resolves links on (`docs/`, `CONTEXT.md`,
 * the READMEs) also come back from a sync pointing at upstream's ADR file names,
 * which no longer exist here. Those references are rewritten to ours too, a
 * markdown link with its `[ADR-NNNN]` label and a bare path alike; a URL to
 * upstream's repo is left alone.
 *
 * Default is a dry run; `--yes` writes. Usage:
 *   bun scripts/adr-reconcile.ts [--yes]
 * Then run `bun run adr:check`.
 */

import type { AdrFile } from './check-adrs';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  /** Upstream number -> our number, persisted rows plus this batch. */
  map: Map<string, string>
  /** Every ADR file name once the plan is applied. */
  adrNames: string[]
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

  return { drops, adds, warnings, readme: next, map, adrNames: [...indexed.map(f => f.name), ...adds.map(a => a.to)] };
}

/** Upstream file name -> ours, for every renumbered ADR whose file exists here. */
export function upstreamFileNames(map: Map<string, string>, adrNames: string[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const [upstream, ours] of map) {
    if (upstream === ours) { continue; }
    const ourName = adrNames.find(name => numberOf(name) === ours);
    if (ourName) { names.set(`ADR-${upstream}-${slugOf(ourName)}.md`, ourName); }
  }
  return names;
}

const LINKED_REF_RE = /\[ADR-(\d{4})\]\(([^)\s#]*?)(ADR-\d{4}-[a-z0-9-]+\.md)/g;
const FILE_REF_RE = /ADR-\d{4}-[a-z0-9-]+\.md/g;

/** True when the path token that ends at `before` is a URL, which points at upstream's own repo. */
function endsInsideUrl(before: string): boolean {
  const start = Math.max(...[' ', '\t', '(', '"', '\'', '`'].map(c => before.lastIndexOf(c)));
  return before.slice(start + 1).includes('://');
}

/**
 * Point a reference to an ADR by upstream's file name at ours: a markdown link
 * (with its `[ADR-NNNN]` label) and a bare path such as an inline-code one. A URL is
 * left alone, because it names a file in upstream's repo.
 */
export function rewriteAdrLinks(content: string, names: Map<string, string>): string {
  const linked = content.replace(LINKED_REF_RE, (whole, _label: string, prefix: string, file: string) => {
    const to = names.get(file);
    return to === undefined || prefix.includes('://') ? whole : `[ADR-${numberOf(to)}](${prefix}${to}`;
  });
  return linked.replace(FILE_REF_RE, (file: string, offset: number, text: string) => {
    const to = names.get(file);
    return to === undefined || endsInsideUrl(text.slice(0, offset)) ? file : to;
  });
}

/** The documents whose ADR references change. */
export function planLinks(docs: AdrFile[], names: Map<string, string>): AdrFile[] {
  return docs
    .map(doc => ({ name: doc.name, content: rewriteAdrLinks(doc.content, names) }))
    .filter((doc, i) => doc.content !== docs[i].content);
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

/**
 * The human documentation surface `docs:check` resolves links on. A synced agent
 * file (`.agents/**`) cites upstream ADR numbers in prose and is read through the
 * README table; history (`.context/audits/**`, the bitacora) is never rewritten.
 */
const HUMAN_DOCS_RE = /^(?:docs\/|CONTEXT\.md$|README\.md$|INSTALLER\.md$|\.context\/README\.md$)/;

function listDocs(root: string): AdrFile[] {
  const listed = Bun.spawnSync(['git', 'ls-files', '-co', '--exclude-standard'], { cwd: root, stdout: 'pipe' }).stdout.toString();
  return listed
    .split('\n')
    .filter(path => /\.(?:md|html)$/.test(path) && HUMAN_DOCS_RE.test(path) && existsSync(join(root, path)))
    .map(name => ({ name, content: readFileSync(join(root, name), 'utf8') }));
}

function main(): void {
  const root = join(import.meta.dir, '..');
  const dir = join(root, '.context', 'ADR');
  const write = process.argv.includes('--yes');
  const { files, readme } = readAdrDir(dir);
  const plan = planReconcile(files, readme);
  const links = planLinks(listDocs(root), upstreamFileNames(plan.map, plan.adrNames));

  const mapRefreshed = plan.readme !== readme;
  if (plan.drops.length === 0 && plan.adds.length === 0 && !mapRefreshed && links.length === 0) {
    console.log('adr-reconcile: nothing to do, every ADR file is in the README index and no document cites an upstream ADR file name.');
    return;
  }
  if (mapRefreshed && plan.drops.length === 0 && plan.adds.length === 0) {
    console.log('map   the upstream number table in README.md is out of date');
  }
  for (const doc of links) { console.log(`link  ${doc.name}  (cites an ADR by upstream file name)`); }
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
  for (const doc of links) { writeFileSync(join(root, doc.name), doc.content); }
  console.log('adr-reconcile: applied. Next: bun run adr:check');
}

if (import.meta.main) { main(); }
