import { describe, expect, it } from 'bun:test';
import { checkAdrs, MAX_PROPOSED_DAYS, statusWord } from './check-adrs';

const TODAY = new Date('2026-10-02T12:00:00Z');

function adr(name: string, status: string, date = '2026-09-01') {
  return { name, content: `# ${name}\n\n- **Status:** ${status}\n- **Date:** ${date}\n` };
}

function readmeWith(rows: { name: string, status: string }[]): string {
  const body = rows
    .map(({ name, status }) => `| [${name.slice(0, 8)}](./${name}) | Title | ${status} | — | — |`)
    .join('\n');
  return `| ADR | Title | Status | Supersedes | Superseded by |\n| --- | --- | --- | --- | --- |\n${body}\n`;
}

describe('statusWord', () => {
  it('takes the first word of a decorated status line', () => {
    expect(statusWord('- **Status:** Accepted (2026-10-01, founder)')).toBe('Accepted');
    expect(statusWord('- **Status:** Superseded by ADR-0018')).toBe('Superseded');
  });

  it('returns null when there is no status line', () => {
    expect(statusWord('# ADR without status')).toBeNull();
  });
});

describe('checkAdrs', () => {
  it('is clean when every ADR is indexed, unique and not stale', () => {
    const files = [adr('ADR-0001-a.md', 'Accepted'), adr('ADR-0002-b.md', 'Accepted')];
    const readme = readmeWith([{ name: 'ADR-0001-a.md', status: 'Accepted' }, { name: 'ADR-0002-b.md', status: 'Accepted' }]);
    expect(checkAdrs(files, readme, TODAY)).toEqual([]);
  });

  it('flags two files that share a number', () => {
    const files = [adr('ADR-0002-a.md', 'Accepted'), adr('ADR-0002-b.md', 'Accepted')];
    const readme = readmeWith([{ name: 'ADR-0002-a.md', status: 'Accepted' }, { name: 'ADR-0002-b.md', status: 'Accepted' }]);
    expect(checkAdrs(files, readme, TODAY).join('\n')).toContain('ADR-0002 is used by 2 files');
  });

  it('flags a file the README index does not list', () => {
    const files = [adr('ADR-0001-a.md', 'Accepted'), adr('ADR-0002-b.md', 'Accepted')];
    const readme = readmeWith([{ name: 'ADR-0001-a.md', status: 'Accepted' }]);
    expect(checkAdrs(files, readme, TODAY)).toEqual(['ADR-0002-b.md is not listed in .context/ADR/README.md']);
  });

  it('flags a Proposed ADR older than the limit, and only then', () => {
    const readme = readmeWith([{ name: 'ADR-0001-a.md', status: 'Proposed' }]);
    const old = [adr('ADR-0001-a.md', 'Proposed', '2026-09-17')]; // 15 days
    const edge = [adr('ADR-0001-a.md', 'Proposed', '2026-09-18')]; // 14 days
    expect(checkAdrs(old, readme, TODAY).join('\n')).toContain(`Proposed for 15 days (limit ${MAX_PROPOSED_DAYS})`);
    expect(checkAdrs(edge, readme, TODAY)).toEqual([]);
  });

  it('ignores the age of ADRs that are not Proposed', () => {
    const files = [adr('ADR-0001-a.md', 'Accepted', '2025-01-01')];
    expect(checkAdrs(files, readmeWith([{ name: 'ADR-0001-a.md', status: 'Accepted' }]), TODAY)).toEqual([]);
  });

  it('flags a README status that disagrees with the file', () => {
    const files = [adr('ADR-0001-a.md', 'Accepted')];
    const readme = readmeWith([{ name: 'ADR-0001-a.md', status: 'Proposed' }]);
    expect(checkAdrs(files, readme, TODAY)).toEqual(['ADR-0001-a.md: README says "Proposed" but the file says "Accepted"']);
  });

  it('flags an ADR with no parseable status', () => {
    const files = [{ name: 'ADR-0001-a.md', content: '# no status here' }];
    const readme = readmeWith([{ name: 'ADR-0001-a.md', status: 'Accepted' }]);
    expect(checkAdrs(files, readme, TODAY)).toEqual(['ADR-0001-a.md has no parseable "- **Status:**" line']);
  });
});
