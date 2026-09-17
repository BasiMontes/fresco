#!/usr/bin/env bun

// FRESCO — genera el CSV de import a AgileTest a partir de
// .context/qa/regression.feature (fuente de la verdad, append-only).
//
// Uso:
//   bun scripts/qa/build-agiletest-csv.ts                    # exporta TODOS los escenarios actuales
//   bun scripts/qa/build-agiletest-csv.ts --since 2026-09-17  # exporta solo los escenarios
//                                                             # que no existían en el .feature
//                                                             # en el último commit <= esa fecha
//                                                             # (evita reimportar los ya subidos)
//
// AgileTest exige el campo Labels como array JSON (`["a","b"]`), no texto
// separado por espacios — ver mem discovery qa/agiletest-import.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).stdout.trim();
const REL_PATH = '.context/qa/regression.feature';
const ABS_PATH = path.join(REPO_ROOT, REL_PATH);
const OUT_DIR = path.join(REPO_ROOT, '.context/qa');

interface Scenario {
  title: string
  tags: string[]
  details: string
}

function parseFeature(content: string): Scenario[] {
  const lines = content.split('\n');
  const scenarios: Scenario[] = [];
  let pendingTags: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const stripped = raw.trim();

    if (stripped.startsWith('@')) {
      pendingTags.push(...stripped.split(/\s+/).map(t => t.replace(/^@/, '')));
      i++;
      continue;
    }

    if (stripped.startsWith('Característica:')) {
      pendingTags = [];
      i++;
      continue;
    }

    if (stripped.startsWith('Escenario:')) {
      const title = stripped.slice('Escenario:'.length).trim();
      const tags = pendingTags;
      pendingTags = [];
      const steps: string[] = [];
      i++;
      while (i < lines.length) {
        const s2 = lines[i].trim();
        if (s2 === '' || s2.startsWith('#')) {
          i++;
          continue;
        }
        if (/^(?:Dado|Cuando|Entonces|Y|Pero)\b/.test(s2)) {
          steps.push(s2);
          i++;
          continue;
        }
        break;
      }
      const details = `Escenario: ${title}\n${steps.map(s => `  ${s}`).join('\n')}`;
      scenarios.push({ title, tags, details });
      continue;
    }

    i++;
  }

  return scenarios;
}

function resolveCommitAtOrBefore(dateStr: string): string | null {
  const res = spawnSync(
    'git',
    ['log', `--before=${dateStr} 23:59:59`, '-1', '--format=%H', '--', REL_PATH],
    { cwd: REPO_ROOT, encoding: 'utf-8' },
  );
  const sha = res.stdout.trim();
  return sha.length > 0 ? sha : null;
}

function readFileAtCommit(sha: string): string | null {
  const res = spawnSync('git', ['show', `${sha}:${REL_PATH}`], { cwd: REPO_ROOT, encoding: 'utf-8' });
  if (res.status !== 0) { return null; }
  return res.stdout;
}

function toCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function main() {
  const args = process.argv.slice(2);
  const sinceIdx = args.indexOf('--since');
  const sinceDate = sinceIdx >= 0 ? args[sinceIdx + 1] : null;

  if (!existsSync(ABS_PATH)) {
    console.error(`No existe: ${ABS_PATH}`);
    process.exit(1);
  }

  const currentContent = readFileSync(ABS_PATH, 'utf-8');
  const currentScenarios = parseFeature(currentContent);

  let toExport = currentScenarios;
  let outName: string;
  const today = new Date().toISOString().slice(0, 10);

  if (sinceDate) {
    const sha = resolveCommitAtOrBefore(sinceDate);
    if (!sha) {
      console.error(`No hay commits de regression.feature antes de ${sinceDate}. Exportando todo.`);
      outName = `agiletest-import-${today}.csv`;
    }
    else {
      const oldContent = readFileAtCommit(sha);
      const oldTitles = new Set((oldContent ? parseFeature(oldContent) : []).map(s => s.title));
      toExport = currentScenarios.filter(s => !oldTitles.has(s.title));
      outName = `agiletest-import-${sinceDate}-to-${today}.csv`;
    }
  }
  else {
    outName = `agiletest-import-${today}.csv`;
  }

  const rows = ['No,Summary,Labels,Details'];
  toExport.forEach((s, idx) => {
    const labels = JSON.stringify(s.tags);
    rows.push(
      [String(idx + 1), toCsvField(s.title), toCsvField(labels), toCsvField(s.details)].join(','),
    );
  });

  const outPath = path.join(OUT_DIR, outName);
  writeFileSync(outPath, `${rows.join('\n')}\n`, 'utf-8');
  console.log(`Escenarios exportados: ${toExport.length} -> ${outPath}`);
}

main();
