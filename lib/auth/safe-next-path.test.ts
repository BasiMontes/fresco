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
});
