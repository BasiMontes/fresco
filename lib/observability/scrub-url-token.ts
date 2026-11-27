/**
 * A8-API-01 (FRESCO-1107): the waitlist confirm / remove link carries its token in the query string
 * (`/lista-de-espera?token=...`), and the signup and password recovery emails carry `token_hash`
 * (`/auth/confirm?token_hash=...`, FRESCO-1305). They reach the page and the server, and must not also land in
 * the analytics and error stores that record the URL. This blanks the value of those query parameters in a
 * URL-shaped string; every other value comes back unchanged.
 */
const SECRET_PARAM = /^token(?:_hash)?$/i;
/** `^` covers a bare query string (`token=...`), as Sentry reports it. */
const TOKEN_PARAM = /((?:^|[?&])token(?:_hash)?=)[^&#\s]*/gi;

/** For a query already split into names and values. */
export function isSecretQueryParam(name: string): boolean {
  return SECRET_PARAM.test(name);
}

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
