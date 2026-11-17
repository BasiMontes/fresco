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
export interface PropDoc { name: string, type: string, optional: boolean }
export interface VariantDoc { name: string, values: string[], default: string | null }
export interface ComponentApi { extends: string[], props: PropDoc[], variants: VariantDoc[] }
export interface Snapshot { colors: ColorToken[], typography: Typography, icons: string[], glyphs: string[], components: Record<string, ComponentApi>, examples: Record<string, string> }

const SCAN_DIRS = ['app', 'components', 'lib'];
/** Components of `components/ui` whose API is documented so far. The next PRs extend the list. */
const DOCUMENTED_COMPONENTS = ['button', 'card', 'tag', 'input', 'alert-banner', 'empty-state', 'checkbox', 'switch', 'segmented-control', 'email-input', 'password-input', 'reveal', 'dialog', 'dropdown', 'popover', 'filter-drawer', 'allergen-reminder', 'css-glyphs'];
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

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

function keyName(name: ts.PropertyName): string {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name) ? name.text : squash(name.getText());
}

function objectProperty(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  const found = object.properties.find((member): member is ts.PropertyAssignment => ts.isPropertyAssignment(member) && keyName(member.name) === name);
  return found?.initializer;
}

/** The `variants` of one `cva(base, { variants, defaultVariants })` call: each axis, its keys and its default. */
function readCvaVariants(call: ts.CallExpression): VariantDoc[] {
  const config = call.arguments[1];
  if (!config || !ts.isObjectLiteralExpression(config)) { return []; }
  const variants = objectProperty(config, 'variants');
  const defaults = objectProperty(config, 'defaultVariants');
  if (!variants || !ts.isObjectLiteralExpression(variants)) { return []; }
  const defaultOf = (axis: string): string | null => {
    const value = defaults && ts.isObjectLiteralExpression(defaults) ? objectProperty(defaults, axis) : undefined;
    if (!value) { return null; }
    return ts.isStringLiteralLike(value) ? value.text : squash(value.getText());
  };
  return variants.properties.flatMap((axis) => {
    if (!ts.isPropertyAssignment(axis) || !ts.isObjectLiteralExpression(axis.initializer)) { return []; }
    const name = keyName(axis.name);
    const values = axis.initializer.properties.flatMap(value => ('name' in value && value.name ? [keyName(value.name)] : []));
    return [{ name, values, default: defaultOf(name) }];
  });
}

/**
 * What a component documents about itself: the props its exported `*Props` interface declares (own members only,
 * what it extends is listed apart, not expanded) and the variant keys of its `cva` calls. Syntax only: no type
 * checker, so a props type that is not an interface or an object literal type is not read.
 */
export function parseComponentApi(source: string): ComponentApi {
  const file = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const api: ComponentApi = { extends: [], props: [], variants: [] };
  const readMembers = (members: ts.NodeArray<ts.TypeElement>, prefix = '') => {
    for (const member of members) {
      if (ts.isPropertySignature(member)) {
        api.props.push({ name: `${prefix}${keyName(member.name)}`, type: member.type ? squash(member.type.getText(file)) : 'unknown', optional: Boolean(member.questionToken) });
      }
    }
  };
  const isExported = (node: ts.Node) => ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
  /** An exported `function X(...)` or `const X = (...) =>`, with its first parameter. */
  const inlineComponent = (node: ts.Statement): { name: string, param: ts.ParameterDeclaration | undefined } | undefined => {
    if (!isExported(node)) { return undefined; }
    if (ts.isFunctionDeclaration(node) && node.name) { return { name: node.name.text, param: node.parameters[0] }; }
    const declaration = ts.isVariableStatement(node) ? node.declarationList.declarations[0] : undefined;
    const init = declaration?.initializer;
    if (declaration && ts.isIdentifier(declaration.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) { return { name: declaration.name.text, param: init.parameters[0] }; }
    return undefined;
  };
  const readDeclaration = (node: ts.Statement) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text.endsWith('Props')) {
      readMembers(node.members);
      api.extends.push(...(node.heritageClauses ?? []).flatMap(clause => clause.types.map(type => squash(type.getText(file)))));
    }
    else if (ts.isTypeAliasDeclaration(node) && node.name.text.endsWith('Props')) {
      // An alias of another type (`type CheckboxProps = React.InputHTMLAttributes<...>`) documents what it aliases.
      if (ts.isTypeLiteralNode(node.type)) { readMembers(node.type.members); }
      else { api.extends.push(squash(node.type.getText(file))); }
    }
  };
  for (const node of file.statements) { if (isExported(node)) { readDeclaration(node); } }
  // A component whose props type is not exported (`interface RevealProps` used only by the function) is still documented.
  if (api.extends.length === 0 && api.props.length === 0) {
    for (const node of file.statements) { if (!isExported(node)) { readDeclaration(node); } }
  }
  // A component whose props are an inline object type (`function Mark({ open }: { open: boolean })`) documents its parameter members.
  // Several such components in one file (css-glyphs) keep their props apart, as `Owner.prop`, since each takes its own.
  if (api.extends.length === 0 && api.props.length === 0) {
    const groups = file.statements.flatMap((node) => {
      const component = inlineComponent(node);
      return component?.param?.type && ts.isTypeLiteralNode(component.param.type) ? [{ name: component.name, members: component.param.type.members }] : [];
    });
    for (const group of groups) { readMembers(group.members, groups.length > 1 ? `${group.name}.` : ''); }
  }
  // A component with no exported `*Props` type (e.g. `forwardRef<El, React.InputHTMLAttributes<El>>`) documents what it forwards.
  const declaresProps = api.extends.length > 0 || api.props.length > 0;
  const visit = (node: ts.Node) => {
    const forwarded = ts.isCallExpression(node) && !declaresProps && /(?:^|\.)forwardRef$/.test(node.expression.getText(file)) ? node.typeArguments?.[1] : undefined;
    if (forwarded) { api.extends.push(squash(forwarded.getText(file))); }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'cva') { api.variants.push(...readCvaVariants(node)); }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return api;
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
    components: Object.fromEntries(DOCUMENTED_COMPONENTS.map(slug => [slug, parseComponentApi(readFileSync(join(root, `components/ui/${slug}.tsx`), 'utf8'))])),
    examples: Object.fromEntries(DOCUMENTED_COMPONENTS.map(slug => [slug, readFileSync(join(root, `${OUT_DIR}/examples/${slug}.example.tsx`), 'utf8')])),
  };
}

const HEADER = '// GENERATED by scripts/generate-design-system.ts, do not edit by hand.\n// Regenerate with `bun run design-system:generate`; scripts/generate-design-system.test.ts fails on drift.\n';

const quote = (value: string) => `'${value.replaceAll('\'', '\\\'')}'`;
const nullable = (value: string | null) => (value === null ? 'null' : quote(value));

export function renderSnapshotModule(snapshot: Snapshot): string {
  const { colors, typography, icons, glyphs, components, examples } = snapshot;
  const lines = [HEADER, 'export const COLOR_TOKENS = ['];
  for (const c of colors) { lines.push(`  { name: ${quote(c.name)}, light: ${quote(c.light)}, dark: ${quote(c.dark)} },`); }
  lines.push('] as const;', '', 'export const FONT_STACKS = {', `  heading: ${quote(typography.fonts.heading)},`, `  sans: ${quote(typography.fonts.sans)},`, '} as const;', '', 'export const TYPE_STEPS = [');
  for (const s of typography.steps) {
    lines.push(`  { step: ${quote(s.step)}, size: ${quote(s.size)}, lineHeight: ${nullable(s.lineHeight)}, letterSpacing: ${nullable(s.letterSpacing)}, fontWeight: ${nullable(s.fontWeight)} },`);
  }
  lines.push('] as const;', '', 'export const ICON_NAMES = [', ...icons.map(name => `  ${quote(name)},`), '] as const;', '', 'export const GLYPH_NAMES = [', ...glyphs.map(name => `  ${quote(name)},`), '] as const;', '');
  lines.push(...renderComponentApis(components), '', ...renderExampleSources(examples), '');
  return lines.join('\n');
}

/** Keys are quoted all or none, as the lint rule demands: a slug such as `alert-banner` needs them. */
function renderComponentApis(components: Record<string, ComponentApi>): string[] {
  const slugs = Object.keys(components);
  const key = (slug: string) => (slugs.some(name => !/^[a-z]\w*$/.test(name)) ? quote(slug) : slug);
  const list = (items: string[]) => `[${items.map(quote).join(', ')}]`;
  const rows = (name: string, items: string[]) => (items.length === 0 ? [`    ${name}: [],`] : [`    ${name}: [`, ...items.map(item => `      ${item},`), '    ],']);
  const lines = ['export const COMPONENT_APIS = {'];
  for (const slug of slugs) {
    const { extends: parents, props, variants } = components[slug];
    lines.push(
      `  ${key(slug)}: {`,
      `    extends: ${list(parents)},`,
      ...rows('props', props.map(p => `{ name: ${quote(p.name)}, type: ${quote(p.type)}, optional: ${p.optional} }`)),
      ...rows('variants', variants.map(v => `{ name: ${quote(v.name)}, values: ${list(v.values)}, default: ${nullable(v.default)} }`)),
      '  },',
    );
  }
  lines.push('} as const;');
  return lines;
}

const quoteSource = (text: string) => `'${text.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'').replaceAll('\r', '\\r').replaceAll('\n', '\\n').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')}'`;

/** The example files verbatim, as template-free JSON strings: the page shows the source without reading the disk at runtime. */
function renderExampleSources(examples: Record<string, string>): string[] {
  const slugs = Object.keys(examples);
  const key = (slug: string) => (slugs.some(name => !/^[a-z]\w*$/.test(name)) ? quote(slug) : slug);
  return ['export const EXAMPLE_SOURCES = {', ...slugs.map(slug => `  ${key(slug)}: ${quoteSource(examples[slug])},`), '} as const;'];
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
