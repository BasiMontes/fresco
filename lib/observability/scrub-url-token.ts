/**
 * A8-API-01 (FRESCO-1107): the waitlist confirm / remove link carries its token in the query string
 * (`/lista-de-espera?token=...`). The token reaches the page and the POST, and must not also land in
 * the analytics and error stores that record the page URL. This blanks the value of any `token`
 * query parameter in a URL-shaped string; every other value comes back unchanged.
 */
const TOKEN_PARAM = /([?&]token=)[^&#\s]*/gi;

export function scrubUrlToken<T>(value: T): T {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(TOKEN_PARAM, '$1redacted') as T;
}

/** A shallow copy of `properties` with `scrubUrlToken` applied to every string value. */
export function scrubUrlTokenInProperties(properties: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, scrubUrlToken(value)]));
}
