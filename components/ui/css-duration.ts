/**
 * Reads a CSS time custom property as milliseconds. Not a plain
 * `parseFloat(getPropertyValue(...))` — found live: Chromium can serialize
 * a `150ms` custom property back out as `.15s` (shorter-form CSS time
 * serialization), and `parseFloat('.15s')` silently reads `0.15`, which
 * collapses the close transition to near-zero instead of 150ms. Unit-aware
 * so it's correct whether the browser hands back `ms` or `s`.
 */
export function readCssDurationMs(propertyName: string, fallbackMs: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim();
  const value = Number.parseFloat(raw);
  if (!raw || Number.isNaN(value)) { return fallbackMs; }
  return raw.endsWith('ms') ? value : value * 1000;
}
