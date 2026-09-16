// FRESCO-541 spike: proves the substitution mechanic a CDN-cache + self-fetch
// layer would need (github.com/vercel/vercel -> "per-request CSP nonces on
// CDN-cached HTML" KB guide). Next.js stamps exactly ONE nonce value across
// every <script> tag on a rendered page (external chunks and inline RSC
// payload alike) -- confirmed by capturing a real `/` render: 62 script tags,
// 1 distinct nonce value. That makes substitution a plain string replace, not
// an HTML-aware parse: no attribute ordering, no multi-nonce document to
// reconcile.
//
// NOT wired into proxy.ts or any request path -- this is investigation
// evidence for FRESCO-541, not production code yet.

/**
 * Replaces every occurrence of `oldNonce` in `html` with `newNonce`. Throws if
 * `oldNonce` doesn't appear at least once: a silent no-op here would mean the
 * returned HTML's script nonces no longer match the CSP header this function's
 * caller is about to set, which is a broken page, not a slow one.
 */
export function substituteNonce(html: string, oldNonce: string, newNonce: string): string {
  if (!html.includes(oldNonce)) {
    throw new Error('substituteNonce: oldNonce not found in html -- refusing a silent no-op');
  }
  return html.split(oldNonce).join(newNonce);
}
