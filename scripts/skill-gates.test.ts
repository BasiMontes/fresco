import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse as parseYaml } from 'yaml';

/**
 * FRESCO-830 / ADR-0039. The sync with the boilerplate (`8d20ac8`, FRESCO-454)
 * regenerated the skills and silently dropped three Fresco-owned gates. Each
 * gate below must stay in the skill text, and the files that hold them must stay
 * in `updater.protected_paths` so `bun run up` does not overwrite them.
 */

const ROOT = join(import.meta.dir, '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const SD = '.agents/skills/sprint-development';
const PM = '.agents/skills/product-management';

const GATES = [
  {
    name: 'reproduction-or-rejection (FRESCO-313)',
    expectations: [
      { file: `${SD}/SKILL.md`, text: 'Reproduction-or-rejection gate' },
      { file: `${SD}/SKILL.md`, text: 'FRESCO-313' },
      { file: `${SD}/references/bug-fix-workflow.md`, text: 'Reproduction-or-rejection gate' },
      { file: `${SD}/references/bug-fix-workflow.md`, text: 'FRESCO-313 contract' },
    ],
  },
  {
    name: 'Definition of Done, close on the metric (FRESCO-404)',
    expectations: [
      { file: `${SD}/SKILL.md`, text: 'close on the metric, not the mechanism' },
      { file: `${SD}/SKILL.md`, text: 'FRESCO-404' },
    ],
  },
  {
    name: 'structured QA fields on new work (FRESCO-281)',
    expectations: [
      { file: `${SD}/SKILL.md`, text: 'Structured QA fields on new work' },
      { file: `${SD}/SKILL.md`, text: 'FRESCO-281' },
      { file: `${SD}/references/bug-fix-workflow.md`, text: 'FRESCO-281 structured-QA-field contract' },
      { file: `${SD}/references/bug-fix-workflow.md`, text: 'Confirm Severity + Error Type are set' },
      { file: `${SD}/references/story-plan.md`, text: 'Escribir a Jira (obligatorio en Stage 1)' },
    ],
  },
  {
    name: 'defect linked to its feature with evidence (FRESCO-282)',
    expectations: [
      { file: `${SD}/SKILL.md`, text: 'Defect → feature link + evidence' },
      { file: `${SD}/SKILL.md`, text: 'FRESCO-282' },
      { file: `${SD}/references/bug-fix-workflow.md`, text: 'FRESCO-282 traceability contract' },
      { file: `${SD}/references/bug-fix-workflow.md`, text: 'Confirm the feature link + evidence are in place' },
    ],
  },
  {
    name: 'Gherkin AC automated in the same PR (FRESCO-321)',
    expectations: [
      { file: `${SD}/SKILL.md`, text: 'Gherkin AC → automated in the same PR' },
      { file: `${SD}/SKILL.md`, text: 'FRESCO-321' },
      { file: `${SD}/SKILL.md`, text: 'ADR-0018 budget clause' },
      { file: `${SD}/references/spec-compliance-matrix.md`, text: 'FRESCO-321' },
    ],
  },
  {
    name: 'AC testability, failing-test question (I22, FRESCO-320)',
    expectations: [
      { file: `${PM}/SKILL.md`, text: '**I22.**' },
      { file: `${PM}/SKILL.md`, text: 'failing-test question' },
      { file: `${PM}/references/acceptance-criteria.md`, text: 'The failing-test question' },
      { file: `${PM}/references/story-refinement.md`, text: 'Testability gate passed' },
    ],
  },
];

describe('closing gates survive a boilerplate sync', () => {
  for (const gate of GATES) {
    test(`${gate.name} is present in the skill text`, () => {
      for (const { file, text } of gate.expectations) {
        expect(read(file), `${file} lost "${text}"`).toContain(text);
      }
    });
  }

  test('every file that holds a gate is listed in updater.protected_paths', () => {
    const project = parseYaml(read('.agents/project.yaml')) as { updater?: { protected_paths?: string[] } };
    const protectedPaths = project.updater?.protected_paths ?? [];
    const gateFiles = [...new Set(GATES.flatMap(gate => gate.expectations.map(e => e.file)))];
    for (const file of gateFiles) {
      expect(protectedPaths, `${file} is not protected from bun run up`).toContain(file);
    }
  });

  test('the gate text points at a Definition of Done file that exists', () => {
    expect(() => read('.context/backlog/definition-of-done.md')).not.toThrow();
  });
});
