#!/usr/bin/env bun

// FRESCO-1207: builds the committed snapshot the /design-system docs read, from the real sources:
// colour tokens and type scale from app/globals.css, icons from the lucide-react imports of the app and
// the CSS glyphs from components/ui/css-glyphs.tsx.
//
//   bun run design-system:generate
//
// Not part of the build: the output is committed and scripts/generate-design-system.test.ts fails when it
// drifts from the sources. The output is already ESLint-clean, so lint-staged leaves it unchanged.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export interface ColorToken { name: string, light: string, dark: string }
export interface TypeStep { step: string, size: string, lineHeight: string | null, letterSpacing: string | null, fontWeight: string | null }
export interface Typography { fonts: { heading: string, sans: string }, steps: TypeStep[] }
export interface Snapshot { colors: ColorToken[], typography: Typography, icons: string[], glyphs: string[] }

const SCAN_DIRS = ['app', 'components', 'lib'];
const OUT_DIR = 'components/design-system';
const GENERATED_FILES = [`${OUT_DIR}/generated.ts`, `${OUT_DIR}/icon-gallery.generated.tsx`];

/** Text of a declaration value starting at `start`, up to the `;` outside any parenthesis. */
function readValue(css: string, start: number): string {
  let depth = 0;
  let end = start;
  for (; end < css.length; end++) {
    const char = css[end];
    if (char === '(') { depth++; }
    else if (char === ')') { depth--; }
    else if (char === ';' && depth === 0) { break; }
  }
  return css.slice(start, end).replace(/\s+/g, ' ').trim();
}

/** Splits `a, b(c, d)` at the commas outside parentheses. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') { depth++; }
    else if (value[i] === ')') { depth--; }
    else if (value[i] === ',' && depth === 0) {
      parts.push(value.slice(from, i).trim());
      from = i + 1;
    }
  }
  parts.push(value.slice(from).trim());
  return parts;
}

/** Every `--raw-color-<name>` in file order. The first declaration wins: later subtrees redeclare static values. */
export function parseColors(css: string): ColorToken[] {
  const seen = new Map<string, ColorToken>();
  for (const match of css.matchAll(/--raw-color-([a-z0-9-]+):\s*/g)) {
    const name = match[1];
    if (seen.has(name)) { continue; }
    const value = readValue(css, match.index + match[0].length);
    const pair = /^light-dark\((.*)\)$/.exec(value);
    const [light, dark] = pair ? splitTopLevel(pair[1]) : [value, value];
    seen.set(name, { name, light, dark });
  }
  return [...seen.values()];
}

/** The body of the `@theme static { ... }` block: the only place the type scale and font stacks live. */
export function extractTheme(css: string): string {
  const open = css.indexOf('@theme');
  const start = open === -1 ? -1 : css.indexOf('{', open);
  if (start === -1) { throw new Error('No @theme block found in app/globals.css'); }
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') { depth++; }
    else if (css[i] === '}' && --depth === 0) { return css.slice(start + 1, i); }
  }
  throw new Error('Unclosed @theme block in app/globals.css');
}

/** The `--text-<step>` scale and the two font stacks of a theme body. A step lacking a metric reports `null`. */
export function parseTypography(theme: string): Typography {
  const metric = (key: string) => new RegExp(`--${key}:([^;]+);`).exec(theme)?.[1].trim() ?? null;
  const font = (key: string) => {
    const value = metric(key);
    if (value === null) { throw new Error(`Font stack --${key} not found in the @theme block`); }
    return value;
  };
  const steps: TypeStep[] = [];
  for (const match of theme.matchAll(/--text-([a-z0-9]+(?:-[a-z0-9]+)*):([^;]+);/g)) {
    const step = match[1];
    steps.push({
      step,
      size: match[2].trim(),
      lineHeight: metric(`text-${step}--line-height`),
      letterSpacing: metric(`text-${step}--letter-spacing`),
      fontWeight: metric(`text-${step}--font-weight`),
    });
  }
  return { fonts: { heading: font('font-heading'), sans: font('font-sans') }, steps };
}

/** Original names imported or re-exported from `lucide-react` (aliases resolved, type-only skipped). */
export function parseIconImports(source: string): string[] {
  const names: string[] = [];
  const file = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  for (const node of file.statements) {
    const isImport = ts.isImportDeclaration(node);
    if (!isImport && !ts.isExportDeclaration(node)) { continue; }
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== 'lucide-react') { continue; }
    const bindings = isImport ? node.importClause?.namedBindings : node.exportClause;
    if (isImport && node.importClause?.isTypeOnly) { continue; }
    if (!isImport && node.isTypeOnly) { continue; }
    if (!bindings || !(ts.isNamedImports(bindings) || ts.isNamedExports(bindings))) { continue; }
    for (const specifier of bindings.elements) {
      if (!specifier.isTypeOnly) { names.push((specifier.propertyName ?? specifier.name).text); }
    }
  }
  return names;
}

export function parseGlyphs(source: string): string[] {
  return [...source.matchAll(/^export function (\w+)/gm)].map(match => match[1]);
}

function listSources(root: string, dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .map(path => `${dir}/${path}`)
    .filter(path => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !GENERATED_FILES.includes(path));
}

export function buildSnapshot(root: string): Snapshot {
  const css = readFileSync(join(root, 'app/globals.css'), 'utf8');
  const icons = new Set<string>();
  for (const file of SCAN_DIRS.flatMap(dir => listSources(root, dir))) {
    for (const name of parseIconImports(readFileSync(join(root, file), 'utf8'))) { icons.add(name); }
  }
  return {
    colors: parseColors(css),
    typography: parseTypography(extractTheme(css)),
    icons: [...icons].sort(),
    glyphs: parseGlyphs(readFileSync(join(root, 'components/ui/css-glyphs.tsx'), 'utf8')),
  };
}

const HEADER = '// GENERATED by scripts/generate-design-system.ts, do not edit by hand.\n// Regenerate with `bun run design-system:generate`; scripts/generate-design-system.test.ts fails on drift.\n';

const quote = (value: string) => `'${value.replaceAll('\'', '\\\'')}'`;
const nullable = (value: string | null) => (value === null ? 'null' : quote(value));

export function renderSnapshotModule(snapshot: Snapshot): string {
  const { colors, typography, icons, glyphs } = snapshot;
  const lines = [HEADER, 'export const COLOR_TOKENS = ['];
  for (const c of colors) { lines.push(`  { name: ${quote(c.name)}, light: ${quote(c.light)}, dark: ${quote(c.dark)} },`); }
  lines.push('] as const;', '', 'export const FONT_STACKS = {', `  heading: ${quote(typography.fonts.heading)},`, `  sans: ${quote(typography.fonts.sans)},`, '} as const;', '', 'export const TYPE_STEPS = [');
  for (const s of typography.steps) {
    lines.push(`  { step: ${quote(s.step)}, size: ${quote(s.size)}, lineHeight: ${nullable(s.lineHeight)}, letterSpacing: ${nullable(s.letterSpacing)}, fontWeight: ${nullable(s.fontWeight)} },`);
  }
  lines.push('] as const;', '', 'export const ICON_NAMES = [', ...icons.map(name => `  ${quote(name)},`), '] as const;', '', 'export const GLYPH_NAMES = [', ...glyphs.map(name => `  ${quote(name)},`), '] as const;', '');
  return lines.join('\n');
}

/** Explicit named imports: a `import * as` would pull every lucide icon into the bundle. */
export function renderGalleryModule(icons: string[]): string {
  return [
    HEADER,
    'import {',
    ...icons.map(name => `  ${name},`),
    '} from \'lucide-react\';',
    '',
    'export const ICON_GALLERY = {',
    ...icons.map(name => `  ${name},`),
    '} as const;',
    '',
  ].join('\n');
}

export function generate(root: string): string[] {
  const snapshot = buildSnapshot(root);
  const outputs: Record<string, string> = {
    [`${OUT_DIR}/generated.ts`]: renderSnapshotModule(snapshot),
    [`${OUT_DIR}/icon-gallery.generated.tsx`]: renderGalleryModule(snapshot.icons),
  };
  mkdirSync(join(root, OUT_DIR), { recursive: true });
  for (const [path, content] of Object.entries(outputs)) { writeFileSync(join(root, path), content); }
  return Object.keys(outputs);
}

if (import.meta.main) {
  const written = generate(fileURLToPath(new URL('..', import.meta.url)));
  console.log(`Wrote ${written.join(', ')}`);
}
