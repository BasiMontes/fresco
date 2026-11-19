import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

// FRESCO-1240: `.bun-version` is what `.husky/pre-push` compares the local Bun with. CI pins its own copy in
// `BUN_VERSION` of each workflow; if the two drift, the hook would ask for a version CI does not run.

const root = join(import.meta.dir, '..');
const wanted = readFileSync(join(root, '.bun-version'), 'utf8').trim();

function workflowPins(): { file: string, version: string }[] {
  const dir = join(root, '.github', 'workflows');
  return readdirSync(dir)
    .filter(name => /\.ya?ml$/.test(name))
    .flatMap((name) => {
      const text = readFileSync(join(dir, name), 'utf8');
      return [...text.matchAll(/^\s*BUN_VERSION:\s*['"]?(\d[^'"\s#]*)['"]?/gm)].map(match => ({ file: name, version: match[1] }));
    });
}

describe('.bun-version', () => {
  test('is a plain x.y.z version', () => {
    expect(wanted).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('matches the BUN_VERSION every workflow pins', () => {
    const pins = workflowPins();

    expect(pins.length).toBeGreaterThan(0);
    expect(pins.filter(pin => pin.version !== wanted)).toEqual([]);
  });
});
