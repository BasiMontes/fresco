import { describe, expect, test } from 'bun:test';

import {
  classifyCoverageLinks,
  classifyQaArtifactEpic,
  DEFAULT_QA_ARTIFACT_LABEL,
  defaultSweepEntries,
  extractClosingCriteria,
  higherAltitudeLabel,
  outOfScopeTypeNames,
} from './sync-jira-issues.ts';

// ---------------------------------------------------------------------------
// Shared fixtures (pure objects — no network, no file writes)
// ---------------------------------------------------------------------------

/** Minimal work-type entry matching the shape `loadRegistry()` produces. */
function entry(over: Record<string, unknown>): Record<string, unknown> {
  return {
    slug: 'story',
    jiraIssueType: 'Story',
    sync: 'never',
    recommended: false,
    coverable: false,
    container: false,
    role: null,
    content: null,
    defectLinkTypes: [],
    localDir: null,
    ...over,
  };
}

/** Builds a Registry (list + byJiraType + bySlug) from plain entries. */
function makeRegistry(entries: Array<Record<string, unknown>>): never {
  const byJiraType = new Map<string, unknown>();
  const bySlug = new Map<string, unknown>();
  for (const e of entries) {
    byJiraType.set(e.jiraIssueType as string, e);
    bySlug.set(e.slug as string, e);
  }
  return { list: entries, byJiraType, bySlug } as never;
}

/** The registry shape this repo ships for coverage discovery. */
const coverageRegistry = makeRegistry([
  entry({ slug: 'story', jiraIssueType: 'Story', sync: 'default', coverable: true }),
  entry({ slug: 'bug', jiraIssueType: 'Bug', sync: 'default' }),
  entry({ slug: 'epic', jiraIssueType: 'Epic', sync: 'default', container: true }),
  entry({ slug: 'defect', jiraIssueType: 'Defect', sync: 'discovery', coverable: true }),
  entry({ slug: 'test_plan', jiraIssueType: 'Test Plan', sync: 'discovery', role: 'atp' }),
  entry({ slug: 'test_execution', jiraIssueType: 'Test Execution', sync: 'discovery', role: 'atr' }),
  entry({ slug: 're_test_execution', jiraIssueType: 'Re-Test Execution', sync: 'discovery', role: 'atr' }),
  entry({ slug: 'test_set', jiraIssueType: 'Test Set', sync: 'never' }),
  entry({ slug: 'test_case', jiraIssueType: 'Test', sync: 'never' }),
]);

/** An issue whose links point at the given (issueType, summary) pairs. */
function issueWithLinks(links: Array<{ type: string, summary: string, key?: string }>): never {
  return {
    key: 'PROJ-1',
    fields: {
      summary: 'A story',
      issuelinks: links.map((l, i) => ({
        id: String(i),
        type: { id: '10', name: 'Test', inward: 'is tested by', outward: 'tests' },
        inwardIssue: {
          key: l.key ?? `PROJ-${100 + i}`,
          fields: { summary: l.summary, issuetype: { name: l.type, subtask: false } },
        },
      })),
    },
  } as never;
}

// ---------------------------------------------------------------------------
// QA-artifact epic classifier (three signals, descending confidence)
// ---------------------------------------------------------------------------

describe('classifyQaArtifactEpic', () => {
  const cfg = { label: DEFAULT_QA_ARTIFACT_LABEL, cachedKeys: new Set(['PROJ-900']) };
  const epic = (over: Record<string, unknown>): never =>
    ({ key: 'PROJ-1', fields: { summary: 'Checkout', labels: [], ...over } }) as never;

  test('a product epic is not an artifact bucket', () => {
    expect(classifyQaArtifactEpic(epic({}), cfg)).toBeNull();
  });

  test('the label is authoritative', () => {
    expect(classifyQaArtifactEpic(epic({ labels: ['QA-Artifact'] }), cfg)).toEqual({ via: 'label' });
  });

  test('a cached qa_epics key is recognized without the label', () => {
    const e = { key: 'PROJ-900', fields: { summary: 'Anything', labels: [] } } as never;
    expect(classifyQaArtifactEpic(e, cfg)).toEqual({ via: 'cached-key' });
  });

  test('falls back to the QA name prefix, reporting the weaker signal', () => {
    expect(classifyQaArtifactEpic(epic({ summary: 'QA Test Repository' }), cfg))
      .toEqual({ via: 'name-prefix' });
  });

  test('the label wins over the prefix so the signal is never downgraded', () => {
    const e = epic({ summary: 'QA Test Repository', labels: ['QA-Artifact'] });
    expect(classifyQaArtifactEpic(e, cfg)).toEqual({ via: 'label' });
  });

  test('"QA" without a trailing space is a product epic', () => {
    // "QAlity Dashboard" must not be swept up by the prefix heuristic.
    expect(classifyQaArtifactEpic(epic({ summary: 'QAlity Dashboard' }), cfg)).toBeNull();
  });

  test('tolerates an epic with no labels field', () => {
    const e = { key: 'PROJ-2', fields: { summary: 'Checkout' } } as never;
    expect(classifyQaArtifactEpic(e, cfg)).toBeNull();
  });

  test('honours a project-specific label instead of the default', () => {
    const custom = { label: 'proceso-qa', cachedKeys: new Set<string>() };
    expect(classifyQaArtifactEpic(epic({ labels: ['proceso-qa'] }), custom)).toEqual({ via: 'label' });
    expect(classifyQaArtifactEpic(epic({ labels: ['QA-Artifact'] }), custom)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Altitude guard (title-prefix classification of linked Plans / Executions)
// ---------------------------------------------------------------------------

describe('higherAltitudeLabel', () => {
  test('sprint-altitude for STP and STR', () => {
    expect(higherAltitudeLabel('STP: Sprint 4 test plan')).toBe('sprint-altitude');
    expect(higherAltitudeLabel('str: sprint 4 results')).toBe('sprint-altitude');
  });

  test('feature-altitude for FTP and the legacy FTR', () => {
    expect(higherAltitudeLabel('FTP: Checkout feature plan')).toBe('feature-altitude');
    expect(higherAltitudeLabel('FTR: Checkout feature results')).toBe('feature-altitude');
  });

  test('master-plan-altitude for MTP', () => {
    expect(higherAltitudeLabel('MTP: Master test plan')).toBe('master-plan-altitude');
  });
});

describe('classifyCoverageLinks — altitude guard', () => {
  test('an ATP: Test Plan feeds the atp bucket', () => {
    const { atp, skipped } = classifyCoverageLinks(
      issueWithLinks([{ type: 'Test Plan', summary: 'ATP: PROJ-1: login plan' }]),
      coverageRegistry,
    );
    expect(atp).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  test('an unprefixed Test Plan keeps the legacy behavior (backward compat)', () => {
    const { atp } = classifyCoverageLinks(
      issueWithLinks([{ type: 'Test Plan', summary: 'Login test plan' }]),
      coverageRegistry,
    );
    expect(atp).toHaveLength(1);
  });

  test('higher-altitude Plans are skipped, never materialized as the ATP', () => {
    for (const summary of ['FTP: Checkout plan', 'STP: Sprint 4 plan', 'MTP: Master plan']) {
      const { atp, skipped } = classifyCoverageLinks(
        issueWithLinks([{ type: 'Test Plan', summary }]),
        coverageRegistry,
      );
      expect(atp).toHaveLength(0);
      expect(skipped).toEqual([expect.objectContaining({ role: 'ATP', summary })]);
    }
  });

  test('an STR: Execution is skipped while a ReTest: Execution counts as ATR', () => {
    const { atr, skipped } = classifyCoverageLinks(
      issueWithLinks([
        { type: 'Test Execution', summary: 'STR: Sprint 4 results' },
        { type: 'Re-Test Execution', summary: 'ReTest: PROJ-1 login' },
      ]),
      coverageRegistry,
    );
    expect(atr).toHaveLength(1);
    expect(atr[0].summary).toBe('ReTest: PROJ-1 login');
    expect(skipped).toEqual([expect.objectContaining({ role: 'ATR' })]);
  });

  test('the legacy FTR prefix still guards pre-migration Executions', () => {
    const { atr, skipped } = classifyCoverageLinks(
      issueWithLinks([{ type: 'Test Execution', summary: 'FTR: Checkout results' }]),
      coverageRegistry,
    );
    expect(atr).toHaveLength(0);
    expect(skipped).toHaveLength(1);
  });

  test('only ATS: Sets are bucketed — feature-level TS: Sets stay ignored', () => {
    const { sets } = classifyCoverageLinks(
      issueWithLinks([
        { type: 'Test Set', summary: 'ATS: PROJ-1: login set' },
        { type: 'Test Set', summary: 'TS: Checkout regression set' },
      ]),
      coverageRegistry,
    );
    expect(sets).toHaveLength(1);
    expect(sets[0].summary).toBe('ATS: PROJ-1: login set');
  });

  test('linked Tests land in the tests bucket', () => {
    const { tests } = classifyCoverageLinks(
      issueWithLinks([{ type: 'Test', summary: 'TC: login happy path' }]),
      coverageRegistry,
    );
    expect(tests).toHaveLength(1);
  });

  test('prefixes match case-insensitively and tolerate leading whitespace', () => {
    const { skipped } = classifyCoverageLinks(
      issueWithLinks([{ type: 'Test Plan', summary: '  stp: sprint plan' }]),
      coverageRegistry,
    );
    expect(skipped).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Declarative pull scope (registry-driven sweep + out-of-scope advisory)
// ---------------------------------------------------------------------------

describe('defaultSweepEntries', () => {
  const reg = makeRegistry([
    entry({ slug: 'epic', jiraIssueType: 'Epic', sync: 'default', container: true }),
    entry({ slug: 'story', jiraIssueType: 'Story', sync: 'default' }),
    entry({ slug: 'bug', jiraIssueType: 'Bug', sync: 'default' }),
    entry({ slug: 'defect', jiraIssueType: 'Defect', sync: 'discovery' }),
    entry({ slug: 'improvement', jiraIssueType: 'Improvement', sync: 'optional' }),
    entry({ slug: 'test_case', jiraIssueType: 'Test', sync: 'never' }),
  ]);

  test('sweeps sync: default types but never Epic/Story (syncAll already walks them)', () => {
    const slugs = defaultSweepEntries(reg).map((e: { slug: string }) => e.slug);
    expect(slugs).toEqual(['bug']);
  });

  test('a widened registry sweeps the extra default type', () => {
    const widened = makeRegistry([
      entry({ slug: 'story', jiraIssueType: 'Story', sync: 'default' }),
      entry({ slug: 'bug', jiraIssueType: 'Bug', sync: 'default' }),
      entry({ slug: 'tech_debt', jiraIssueType: 'Tech Debt', sync: 'default' }),
    ]);
    const slugs = defaultSweepEntries(widened).map((e: { slug: string }) => e.slug);
    expect(slugs).toEqual(['bug', 'tech_debt']);
  });
});

describe('outOfScopeTypeNames', () => {
  const reg = makeRegistry([
    entry({ slug: 'story', jiraIssueType: 'Story', sync: 'default' }),
    entry({ slug: 'bug', jiraIssueType: 'Bug', sync: 'default' }),
    entry({ slug: 'defect', jiraIssueType: 'Defect', sync: 'discovery' }),
    entry({ slug: 'test_case', jiraIssueType: 'Test', sync: 'never' }),
    entry({ slug: 'improvement', jiraIssueType: 'Improvement', sync: 'optional' }),
    entry({ slug: 'tech_story', jiraIssueType: 'Tech Story', sync: 'optional' }),
  ]);
  const present = ['Story', 'Bug', 'Defect', 'Test', 'Improvement', 'Tech Story'];

  test('default, discovery and test_case types are in scope; optional types are named', () => {
    expect(outOfScopeTypeNames(present, reg, [])).toEqual(['Improvement', 'Tech Story']);
  });

  test('a --types slug pulls its type back into scope', () => {
    expect(outOfScopeTypeNames(present, reg, ['improvement'])).toEqual(['Tech Story']);
  });

  test('dash-form slugs normalize to the underscore registry key', () => {
    expect(outOfScopeTypeNames(present, reg, ['tech-story'])).toEqual(['Improvement']);
  });

  test('an unknown slug is ignored rather than throwing', () => {
    expect(outOfScopeTypeNames(present, reg, ['nope'])).toEqual(['Improvement', 'Tech Story']);
  });

  test('a type unknown to the registry is reported as out of scope', () => {
    expect(outOfScopeTypeNames(['Story', 'Task'], reg, [])).toEqual(['Task']);
  });

  test('empty when everything present is covered', () => {
    expect(outOfScopeTypeNames(['Story', 'Bug', 'Defect', 'Test'], reg, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractClosingCriteria (FRESCO-1253: acceptance criteria live in the description)
// ---------------------------------------------------------------------------

describe('extractClosingCriteria', () => {
  test('returns the section body without its heading, up to the next heading of the same level', () => {
    const md = ['Intro.', '', '## Criterio de cierre', '', '- A pasa', '- B pasa', '', '## Notas', '', 'otra cosa'].join('\n');
    expect(extractClosingCriteria(md)).toBe('- A pasa\n- B pasa');
  });

  test('accepts the aliases the board already uses and any case', () => {
    expect(extractClosingCriteria('### CRITERIOS DE ACEPTACIÓN\n\nuno')).toBe('uno');
    expect(extractClosingCriteria('## Acceptance criteria\n\ntwo')).toBe('two');
    expect(extractClosingCriteria('## Criterios de cierre\n\ntres')).toBe('tres');
  });

  test('keeps a deeper heading inside the section and runs to the end of the text', () => {
    const md = '## Criterio de cierre\n\n### Caso feliz\n\nok';
    expect(extractClosingCriteria(md)).toBe('### Caso feliz\n\nok');
  });

  test('a heading-looking line inside a fenced block does not end the section', () => {
    const md = ['## Criterio de cierre', '', '```gherkin', '# comentario', '## no soy un titulo', 'Given algo', '```', '', '## Siguiente'].join('\n');
    expect(extractClosingCriteria(md)).toBe('```gherkin\n# comentario\n## no soy un titulo\nGiven algo\n```');
  });

  // FRESCO-1279: a `Verificación` section is a measurement or a post-deploy check, not the closing criteria.
  test('a Verificación section alone is not read as the closing criteria', () => {
    const md = ['Contexto.', '', '## Verificación', '', 'Medido en producción: la captura pesa 26 KiB.'].join('\n');
    expect(extractClosingCriteria(md)).toBe('');
  });

  test('with both sections, only the closing criteria come out', () => {
    const md = ['## Verificación', '', 'Remedir tras el despliegue.', '', '## Criterio de cierre', '', '- A pasa', '', '## Notas', '', 'otra cosa'].join('\n');
    expect(extractClosingCriteria(md)).toBe('- A pasa');
  });

  test('falls back to the inline label older cards use, up to the end of the text', () => {
    const md = 'Hoy la regla no existe. Fuera de alcance: regenerar. Criterio de cierre: una receta sin temporada no se puede guardar, y el informe está revisado.';
    expect(extractClosingCriteria(md)).toBe('una receta sin temporada no se puede guardar, y el informe está revisado.');
  });

  test('the inline label stops at the next heading and accepts a bolded label', () => {
    const md = ['Texto.', '', '**Criterios de aceptación:** uno', 'dos', '', '## Notas', 'otra cosa'].join('\n');
    expect(extractClosingCriteria(md)).toBe('uno\ndos');
  });

  test('a heading section wins over an inline label', () => {
    const md = ['Criterio de cierre: viejo', '', '## Criterio de cierre', '', 'nuevo'].join('\n');
    expect(extractClosingCriteria(md)).toBe('nuevo');
  });

  test('returns an empty string when the description has no such section', () => {
    expect(extractClosingCriteria('## Contexto\n\ntexto')).toBe('');
    expect(extractClosingCriteria('')).toBe('');
  });
});
