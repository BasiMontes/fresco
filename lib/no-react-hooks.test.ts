import { readFileSync } from 'node:fs';
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-810 (ADR-0041): `lib/` holds no React hooks, they live next to the
 * component that uses them. ESLint (`no-restricted-imports`) catches a named
 * `import { useState } from 'react'` but cannot see `React.useState`, so this
 * reads the source for both forms.
 */

const NAMED_HOOK = /\buse(?:State|Effect|Ref|Memo|Callback|Reducer|Context|LayoutEffect|InsertionEffect|ImperativeHandle|Id|Transition|DeferredValue|SyncExternalStore|Optimistic|ActionState)\b/;
const NAMESPACE_HOOK = /\bReact\.use[A-Z]\w*/;

function libSourceFiles(): string[] {
  return [...new Glob('lib/**/*.{ts,tsx}').scanSync('.')]
    .filter(file => !/\.(?:test|spec)\.tsx?$/.test(file))
    .sort();
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('lib/ holds no React hooks', () => {
  test('no source file calls a React hook, by name or as React.useX', () => {
    const offenders = libSourceFiles().filter((file) => {
      const source = stripComments(readFileSync(file, 'utf8'));
      return NAMESPACE_HOOK.test(source) || (/from 'react'/.test(source) && NAMED_HOOK.test(source));
    });

    expect(offenders).toEqual([]);
  });

  test('the scan sees the lib/ files it is meant to guard', () => {
    expect(libSourceFiles().length).toBeGreaterThan(50);
  });
});
