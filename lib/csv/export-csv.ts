/**
 * CSV serialization for `/api/profile/export` (the `/profile` "Backup CSV" —
 * FRESCO-70 / FRESCO-163). Extracted from the route so the escaping is unit
 * testable.
 */

// CSV / formula injection (FRESCO-364 / A4-L3): a spreadsheet app (Excel,
// Sheets, LibreOffice) executes a cell whose value starts with any of these
// as a formula — `=1+1`, `@SUM(...)`, `+cmd`, `-2+3` — and a leading tab / CR
// can also break out of the intended cell. Prefixing with a single quote
// forces the whole value to be read as text.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Escapes one CSV field per RFC 4180, with formula-injection neutralization.
 * `null` / `undefined` become an empty field; nested objects/arrays (this
 * app's jsonb columns) are JSON-stringified so they stay in one cell.
 */
export function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let raw = typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (FORMULA_TRIGGER.test(raw)) {
    raw = `'${raw}`;
  }

  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/**
 * One table's rows -> a CSV block (header line + one line per row). Columns
 * are the union of every row's own keys, so this never drifts from the real
 * schema. Returns `null` for an empty table.
 */
export function rowsToCsv(rows: Record<string, unknown>[]): string | null {
  if (rows.length === 0) {
    return null;
  }

  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const lines = [
    columns.map(toCsvValue).join(','),
    ...rows.map(row => columns.map(column => toCsvValue(row[column])).join(',')),
  ];
  return lines.join('\n');
}
