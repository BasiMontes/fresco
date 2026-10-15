import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { applyPlan, MAP_END, MAP_START, planReconcile } from './adr-reconcile';

const adr = (number: string, title: string, extra = '', body = 'Body.'): string => [
  `# ADR-${number} — ${title}`,
  '',
  '- **Status:** Accepted',
  '- **Date:** 2026-10-01',
  '- **Deciders:** someone',
  '- **Tags:** tooling',
  '- **Supersedes:** —',
  '- **Superseded by:** —',
  ...(extra === '' ? [] : [extra]),
  '',
  '---',
  '',
  body,
].join('\n');

const row = (number: string, slug: string, title: string): string =>
  `| [ADR-${number}](./ADR-${number}-${slug}.md) | ${title} | Accepted | — | — |`;

function readme(rows: string[], withMap = true): string {
  return [
    '# ADRs',
    '',
    '| ADR | Title | Status | Supersedes | Superseded by |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    ...(withMap ? [MAP_START, '', '| Upstream | Ours |', '| --- | --- |', '', MAP_END] : []),
    '',
    '## References',
  ].join('\n');
}

const ours = [
  { name: 'ADR-0001-first.md', content: adr('0001', 'First') },
  { name: 'ADR-0002-second.md', content: adr('0002', 'Second') },
];
const baseReadme = readme([row('0001', 'first', 'First'), row('0002', 'second', 'Second')]);

describe('planReconcile', () => {
  test('does nothing when every ADR file is in the index', () => {
    const plan = planReconcile(ours, baseReadme);
    expect(plan.drops).toEqual([]);
    expect(plan.adds).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });

  test('renumbers an incoming ADR whose number is taken, with title, upstream line and index row', () => {
    const plan = planReconcile(
      [...ours, { name: 'ADR-0002-brand-new.md', content: adr('0002', 'Brand new') }],
      baseReadme,
    );
    expect(plan.adds).toHaveLength(1);
    const [add] = plan.adds;
    expect(add.to).toBe('ADR-0003-brand-new.md');
    expect(add.renumbered).toBe(true);
    expect(add.content).toContain('# ADR-0003 — Brand new');
    expect(add.content).toContain('- **Upstream number:** ADR-0002 (renumbered on import');
    expect(plan.readme).toContain('| [ADR-0003](./ADR-0003-brand-new.md) | Brand new | Accepted | — | — |');
    expect(plan.readme).toContain('| ADR-0002 | [ADR-0003](./ADR-0003-brand-new.md) |');
  });

  test('keeps a free number untouched and adds no upstream line or map row', () => {
    const plan = planReconcile(
      [...ours, { name: 'ADR-0007-free.md', content: adr('0007', 'Free') }],
      baseReadme,
    );
    const [add] = plan.adds;
    expect(add.to).toBe('ADR-0007-free.md');
    expect(add.renumbered).toBe(false);
    expect(add.content).not.toContain('Upstream number');
    expect(plan.readme).toContain('| [ADR-0007](./ADR-0007-free.md) | Free | Accepted | — | — |');
    expect(plan.readme).not.toContain('| ADR-0007 |');
  });

  test('drops an incoming ADR whose slug is already ours and maps its number', () => {
    const plan = planReconcile(
      [...ours, { name: 'ADR-0009-second.md', content: adr('0009', 'Second') }],
      baseReadme,
    );
    expect(plan.adds).toEqual([]);
    expect(plan.drops).toEqual([{ name: 'ADR-0009-second.md', keptAs: 'ADR-0002-second.md', differs: true }]);
    expect(plan.readme).toContain('| ADR-0009 | [ADR-0002](./ADR-0002-second.md) |');
  });

  test('flags no difference when the imported text equals the copy we hold', () => {
    const held = adr('0003', 'Imported', '- **Upstream number:** ADR-0009 (renumbered on import because this project already used that number; synced files cite the upstream number)');
    const plan = planReconcile(
      [...ours, { name: 'ADR-0003-imported.md', content: held }, { name: 'ADR-0009-imported.md', content: adr('0009', 'Imported') }],
      readme([row('0001', 'first', 'First'), row('0002', 'second', 'Second'), row('0003', 'imported', 'Imported')]),
    );
    expect(plan.drops).toEqual([{ name: 'ADR-0009-imported.md', keptAs: 'ADR-0003-imported.md', differs: false }]);
  });

  test('rewrites citations between ADRs imported in the same batch', () => {
    const plan = planReconcile(
      [
        ...ours,
        { name: 'ADR-0001-alpha.md', content: adr('0001', 'Alpha') },
        { name: 'ADR-0002-beta.md', content: adr('0002', 'Beta', '', 'Builds on ADR-0001 and ADR-0002.') },
      ],
      baseReadme,
    );
    const beta = plan.adds.find(a => a.from === 'ADR-0002-beta.md')!;
    expect(plan.adds.map(a => a.to)).toEqual(['ADR-0003-alpha.md', 'ADR-0004-beta.md']);
    expect(beta.content).toContain('Builds on ADR-0003 and ADR-0004.');
  });

  test('resolves a citation through the persisted README map and warns on an unmapped one', () => {
    const persisted = readme([row('0001', 'first', 'First'), row('0002', 'second', 'Second')])
      .replace(`| --- | --- |\n\n${MAP_END}`, `| --- | --- |\n| ADR-0010 | [ADR-0001](./ADR-0001-first.md) |\n\n${MAP_END}`);
    const plan = planReconcile(
      [...ours, { name: 'ADR-0002-gamma.md', content: adr('0002', 'Gamma', '', 'See ADR-0010 and ADR-0044.') }],
      persisted,
    );
    expect(plan.adds[0].content).toContain('See ADR-0001 and ADR-0044.');
    expect(plan.warnings).toEqual(['ADR-0002-gamma.md cites ADR-0044, which has no mapping; it resolves to our ADR-0044']);
  });

  test('inserts the new row in number order and fills the supersedes cells from the header', () => {
    const incoming = adr('0002', 'Newer', '').replace('- **Supersedes:** —', '- **Supersedes:** ADR-0001 (the rest stands)');
    const plan = planReconcile(
      [...ours, { name: 'ADR-0002-newer.md', content: incoming }],
      readme([row('0001', 'first', 'First'), row('0002', 'second', 'Second'), row('0004', 'later', 'Later')]),
    );
    const lines = plan.readme.split('\n').filter(l => l.startsWith('| [ADR-'));
    expect(lines.map(l => /ADR-(\d{4})/.exec(l)![1])).toEqual(['0001', '0002', '0003', '0004']);
    expect(lines[2]).toContain('| Accepted | ADR-0001 | — |');
  });

  test('warns, but still plans, when the README has no map markers', () => {
    const plan = planReconcile(
      [...ours, { name: 'ADR-0002-late.md', content: adr('0002', 'Late') }],
      readme([row('0001', 'first', 'First'), row('0002', 'second', 'Second')], false),
    );
    expect(plan.adds).toHaveLength(1);
    expect(plan.warnings[0]).toContain('has no <!-- upstream-adr-map:start -->');
  });

  test('is stable: planning the result again changes nothing', () => {
    const first = planReconcile(
      [...ours, { name: 'ADR-0002-brand-new.md', content: adr('0002', 'Brand new') }],
      baseReadme,
    );
    const after = [
      ...ours,
      ...first.adds.map(a => ({ name: a.to, content: a.content })),
    ];
    const second = planReconcile(after, first.readme);
    expect(second.drops).toEqual([]);
    expect(second.adds).toEqual([]);
    expect(second.readme).toBe(first.readme);
  });
});

describe('applyPlan', () => {
  test('writes the renumbered file, removes the originals and rewrites the README', () => {
    const dir = mkdtempSync(join(tmpdir(), 'adr-reconcile-'));
    try {
      const files = [
        ...ours,
        { name: 'ADR-0002-brand-new.md', content: adr('0002', 'Brand new') },
        { name: 'ADR-0009-second.md', content: adr('0009', 'Second') },
      ];
      for (const f of files) { writeFileSync(join(dir, f.name), f.content); }
      writeFileSync(join(dir, 'README.md'), baseReadme);

      applyPlan(dir, planReconcile(files, baseReadme));

      expect(readdirSync(dir).sort()).toEqual([
        'ADR-0001-first.md',
        'ADR-0002-second.md',
        'ADR-0003-brand-new.md',
        'README.md',
      ]);
      expect(readFileSync(join(dir, 'ADR-0003-brand-new.md'), 'utf8')).toContain('# ADR-0003 — Brand new');
      expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain('[ADR-0003](./ADR-0003-brand-new.md)');
    }
    finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
