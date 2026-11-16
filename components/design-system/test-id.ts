/** snake_case part of a `data-testid`: `accent-2-100` -> `accent_2_100`, `CalendarPlus` -> `calendar_plus`. */
export function testIdPart(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replaceAll('-', '_').toLowerCase();
}
