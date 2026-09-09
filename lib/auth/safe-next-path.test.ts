import { describe, expect, it } from 'bun:test';
import { safeNextPath } from './safe-next-path';

describe('safeNextPath (FRESCO-364 / A4-L1)', () => {
  it('keeps a plain in-app path', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/menu?week=2026-W10')).toBe('/menu?week=2026-W10');
  });

  it('falls back to / for empty / missing input', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });

  it('rejects an absolute external URL', () => {
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('http://evil.com/path')).toBe('/');
  });

  it('rejects a protocol-relative URL', () => {
    expect(safeNextPath('//evil.com')).toBe('/');
  });

  it('rejects anything containing a backslash (the A4-L1 bypass)', () => {
    expect(safeNextPath('\\evil.com')).toBe('/');
    expect(safeNextPath('\\\\evil.com')).toBe('/');
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('\\/evil.com')).toBe('/');
    expect(safeNextPath('/menu\\..\\x')).toBe('/');
  });

  it('does not let a relative path escape the origin', () => {
    // resolves to http://localhost/ — pathname stays in-app
    expect(safeNextPath('/../../etc')).toBe('/etc');
    expect(safeNextPath('/@evil.com')).toBe('/@evil.com');
  });

  // FRESCO-465 — explicit boundary batch on the redirect-target frontiers.
  describe('scheme / encoding boundary (FRESCO-465)', () => {
    it.each([
      ['javascript: scheme', 'javascript:alert(1)'],
      ['JavaScript: scheme (mixed case)', 'JavaScript:alert(1)'],
      ['data: scheme', 'data:text/html,<script>alert(1)</script>'],
      ['leading-backslash protocol-relative', '/\\evil.com'],
      ['bare double slash', '//evil.com'],
      ['tab-prefixed scheme', '\tjavascript:alert(1)'],
      ['percent-encoded double slash', '%2F%2Fevil.com'],
    ] as const)('falls back to / for %s', (_label, raw) => {
      expect(safeNextPath(raw)).toBe('/');
    });

    it('keeps a single leading slash (the boundary that IS allowed)', () => {
      expect(safeNextPath('/')).toBe('/');
      expect(safeNextPath('/a')).toBe('/a');
    });
  });
});
