/**
 * FRESCO-788 (audit-6 A6-A1) — fails when the product code has a circular import.
 *
 * AGENTS.md §10 forbids dependency cycles and nothing enforced it. This walks
 * `app/`, `components/` and `lib/` (tests excluded), resolves every import with
 * TypeScript's own module resolution and the repo's tsconfig, so the `@/` alias
 * and the extensions resolve exactly as `tsc` does, and reports any strongly
 * connected component of more than one file (or a file importing itself).
 *
 * Type-only imports count: a cycle between types is still a cycle in the design,
 * and the project has none today. No dependency beyond `typescript`, which the
 * repo already ships; a graph tool such as `madge` pulls ~90 packages in for this.
 *
 * Usage: `bun run cycles:check`.
 */

import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

export type Graph = Map<string, string[]>;

/** Strongly connected components with more than one node, plus self-loops (Tarjan). Each cycle is sorted for stable output. */
export function findCycles(graph: Graph): string[][] {
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  function visit(node: string): void {
    index.set(node, counter);
    low.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of graph.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node)!, low.get(next)!));
      }
      else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node)!, index.get(next)!));
      }
    }

    if (low.get(node) === index.get(node)) {
      const component: string[] = [];
      let member: string | undefined;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== node);

      const selfLoop = component.length === 1 && (graph.get(node) ?? []).includes(node);
      if (component.length > 1 || selfLoop) {
        cycles.push(component.sort());
      }
    }
  }

  for (const node of graph.keys()) {
    if (!index.has(node)) {
      visit(node);
    }
  }

  return cycles.sort((a, b) => a[0].localeCompare(b[0]));
}

const SOURCE = /\.(?:ts|tsx)$/;
const IGNORED = /\.(?:test|spec)\.tsx?$|\.d\.ts$/;

function listSources(dir: string): string[] {
  return ts.sys.readDirectory(dir, ['.ts', '.tsx'], undefined, undefined)
    .filter(file => SOURCE.test(file) && !IGNORED.test(file) && !file.includes(`${sep}node_modules${sep}`));
}

/** Import graph of the files under `roots`, following edges to any resolvable project file. Keys are paths relative to `projectRoot`. */
export function buildGraph({ projectRoot, roots, tsconfig = 'tsconfig.json' }: { projectRoot: string, roots: string[], tsconfig?: string }): Graph {
  const configPath = join(projectRoot, tsconfig);
  const read = ts.readConfigFile(configPath, path => ts.sys.readFile(path));
  const options = ts.parseJsonConfigFileContent(read.config, ts.sys, projectRoot).options;

  const graph: Graph = new Map();
  const pending = roots.flatMap(root => listSources(join(projectRoot, root)));
  const rel = (file: string) => relative(projectRoot, file);

  while (pending.length > 0) {
    const file = pending.pop()!;
    const key = rel(file);
    if (graph.has(key)) {
      continue;
    }

    const text = ts.sys.readFile(file) ?? '';
    const edges = new Set<string>();
    for (const imported of ts.preProcessFile(text, true, true).importedFiles) {
      const resolved = ts.resolveModuleName(imported.fileName, file, options, ts.sys).resolvedModule?.resolvedFileName;
      if (!resolved || resolved.includes(`${sep}node_modules${sep}`) || !resolve(resolved).startsWith(resolve(projectRoot) + sep)) {
        continue;
      }
      if (!SOURCE.test(resolved) || IGNORED.test(resolved)) {
        continue;
      }
      edges.add(rel(resolved));
      if (!graph.has(rel(resolved))) {
        pending.push(resolved);
      }
    }
    graph.set(key, [...edges].sort());
  }

  return graph;
}

function main(): void {
  const projectRoot = resolve(dirname(import.meta.path), '..');
  const graph = buildGraph({ projectRoot, roots: ['app', 'components', 'lib'] });
  const cycles = findCycles(graph);

  if (cycles.length === 0) {
    console.log(`cycles:check: ${graph.size} files, no circular import.`);
    return;
  }

  console.error(`cycles:check: ${cycles.length} circular import group(s) found (AGENTS.md §10 forbids cycles):`);
  for (const cycle of cycles) {
    console.error(`  - ${cycle.join('  <->  ')}`);
  }
  process.exit(1);
}

if (import.meta.main) {
  main();
}
