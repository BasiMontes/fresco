import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-1017 (audit 7b, A7-SUPPLY-01): an MCP server launched with `bunx -y <package>` runs whatever
 * the registry serves at that moment, with the developer's credentials in its environment. A package
 * with no version, or `@latest`, hands the next release to the agent session unreviewed. Every package
 * a tracked MCP config launches carries an exact version, so a bump is a reviewed diff.
 *
 * This is the lint the ticket asks for: it reads the three host configs and fails on an unpinned
 * package. `agents:compat:check` also pins the two servers the boilerplate ships (the contract in
 * `cli/lib/agent-compatibility-contracts.ts`), but it does not see a server only this project adds.
 */

const MCP_CONFIGS = ['.mcp.json', 'opencode.jsonc', '.codex/config.toml'] as const;

/** `name@1.2.3` or `@scope/name@1.2.3`, with an optional prerelease. No ranges, no tags. */
const EXACT_VERSION = /^(?:@[\w.-]+\/)?[\w.-]+@\d+\.\d+\.\d+(?:-[\w.]+)?$/;

/** Every double-quoted string literal in a JSON / JSONC / TOML file, unescaped, in order. */
function stringLiterals(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
    try {
      found.push(JSON.parse(`"${match[1]}"`) as string);
    }
    catch {
      found.push(match[1]);
    }
  }
  return found;
}

/** The package specs a config launches: the argument after `-y` or `-p`, and `bunx -y X` / `npx -y X` inside a shell string. */
export function launchedPackages(text: string): string[] {
  const literals = stringLiterals(text);
  const specs: string[] = [];
  literals.forEach((literal, index) => {
    if ((literal === '-y' || literal === '-p') && literals[index + 1] !== undefined) {
      specs.push(literals[index + 1]);
    }
    for (const inline of literal.matchAll(/\b(?:bunx|npx)\s+(?:-y\s+)?([@\w][^\s"']*)/g)) {
      specs.push(inline[1]);
    }
  });
  return [...new Set(specs.filter(spec => !spec.startsWith('-')))];
}

/** The launched packages that are not pinned to an exact version. */
export function unpinnedPackages(text: string): string[] {
  return launchedPackages(text).filter(spec => !EXACT_VERSION.test(spec));
}

describe('unpinnedPackages', () => {
  test('accepts exact versions, scoped or not, as plain args or inside a shell string', () => {
    expect(unpinnedPackages('{"args": ["-y", "@scope/pkg@1.2.3"]}')).toEqual([]);
    expect(unpinnedPackages('{"args": ["-p", "varlock@1.20.0", "varlock"]}')).toEqual([]);
    expect(unpinnedPackages('{"args": ["sh", "-c", "exec bunx -y mcp-remote@0.14.3 \\"https://x\\""]}')).toEqual([]);
  });

  test('rejects @latest, a missing version, a range and a tag', () => {
    expect(unpinnedPackages('{"args": ["-y", "@scope/pkg@latest"]}')).toEqual(['@scope/pkg@latest']);
    expect(unpinnedPackages('{"args": ["-y", "pkg"]}')).toEqual(['pkg']);
    expect(unpinnedPackages('{"args": ["-y", "pkg@^1.2.3"]}')).toEqual(['pkg@^1.2.3']);
    expect(unpinnedPackages('{"args": ["-y", "pkg@next"]}')).toEqual(['pkg@next']);
    expect(unpinnedPackages('{"args": ["sh", "-c", "exec bunx -y mcp-remote \\"https://x\\""]}')).toEqual(['mcp-remote']);
  });

  test('does not mistake a flag or a value for a package', () => {
    expect(unpinnedPackages('{"args": ["-y", "pkg@1.0.0", "--read-only", "--project-ref=abc"]}')).toEqual([]);
  });
});

describe('tracked MCP configs', () => {
  test.each(MCP_CONFIGS)('%s launches only exact-version packages', (path) => {
    const text = readFileSync(path, 'utf8');

    expect(launchedPackages(text).length).toBeGreaterThan(0);
    expect(unpinnedPackages(text)).toEqual([]);
    expect(text).not.toMatch(/@latest\b/);
  });

  test('the Supabase MCP runs read-only and scoped to one project in every config', () => {
    for (const path of MCP_CONFIGS) {
      const text = readFileSync(path, 'utf8');

      expect(text).toContain('"--read-only"');
      expect(text).toMatch(/"--project-ref=[a-z0-9]{20}"/);
    }
  });
});
