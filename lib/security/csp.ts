// FRESCO-386 (audit-4 A4-M10): Content-Security-Policy, enforcing + nonce.
//
// This lives here (not `next.config.mjs`) because a per-request nonce can
// only be set from `proxy.ts` — a static config header has no request to
// derive one from. `next.config.mjs` keeps the other, request-independent
// security headers (HSTS, X-Frame-Options, …).
//
// `script-src` is `'self' 'nonce-<n>' 'strict-dynamic'`:
//   - no `'unsafe-inline'` — the actual XSS fix (A4-M10).
//   - `'strict-dynamic'` — a nonce'd script may load more scripts, so the
//     bundled PostHog / Sentry init (loaded by Next's nonce'd runtime) is
//     trusted transitively. It also makes host allowlists in `script-src`
//     inert, so none are listed there.
//   - `'unsafe-eval'` is added only in development (React's eval-based error
//     overlay). Next.js does not use eval in production. The A4-L21 report
//     was a WebAssembly source — `'wasm-unsafe-eval'` covers it without
//     opening general eval.
//
// `style-src` keeps `'unsafe-inline'`: A4-M10 only calls for hardening
// `script-src`, and a nonce'd `style-src` would break every `style={{…}}`
// prop in the app (inline style attributes can't carry a nonce). Style
// injection is a much weaker XSS vector than script injection.

/** `https://host[:port]` of a URL string, or null when unparseable/unset. */
export function toOrigin(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).origin;
  }
  catch {
    return null;
  }
}

/**
 * Sentry's Security Header (CSP) report endpoint, derived from the public DSN
 * `https://<key>@<host>/<projectId>`:
 * `https://<host>/api/<projectId>/security/?sentry_key=<key>`.
 */
export function sentryCspReportUri(dsn: string | undefined): string | null {
  if (!dsn) {
    return null;
  }
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/\//g, '');
    if (!projectId || !url.username) {
      return null;
    }
    return `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${url.username}`;
  }
  catch {
    return null;
  }
}

// Well-known third parties the browser actually talks to (connect/img only —
// `script-src` uses `'strict-dynamic'`, so hosts there are ignored). Stripe
// is intentionally absent: checkout is a server call + full-page redirect to
// Stripe's hosted page, so the browser never loads Stripe.js.
//
// PostHog and Sentry are pinned as static wildcard hosts, not derived from
// the NEXT_PUBLIC_* vars — those aren't populated in every Vercel build
// scope, and the allowlist for well-known third parties must not silently
// degrade per environment.
const POSTHOG_HOSTS = ['https://*.posthog.com', 'https://*.i.posthog.com'];
const SENTRY_HOSTS = [
  'https://*.sentry.io',
  'https://*.ingest.sentry.io',
  'https://*.ingest.us.sentry.io',
  'https://*.ingest.de.sentry.io',
];

const dedupe = (list: (string | null | undefined)[]): string[] => [...new Set(list.filter((v): v is string => Boolean(v)))];

export interface BuildCspOptions {
  nonce: string
  isDev: boolean
  reportUri?: string | null
}

/**
 * The full `Content-Security-Policy` header value. `env` defaults to
 * `process.env` so callers just pass the nonce.
 */
export function buildContentSecurityPolicy(
  { nonce, isDev, reportUri }: BuildCspOptions,
  env: Record<string, string | undefined> = process.env,
): string {
  const supabaseOrigin = toOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseFunctionsOrigin = toOrigin(env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL);
  const supabaseRealtimeOrigin = supabaseOrigin?.replace(/^https:/, 'wss:') ?? null;
  const posthogOrigin = toOrigin(env.NEXT_PUBLIC_POSTHOG_HOST);
  const sentryIngestOrigin = toOrigin(env.NEXT_PUBLIC_SENTRY_DSN);

  const scriptSrc = [
    '\'self\'',
    `'nonce-${nonce}'`,
    '\'strict-dynamic\'',
    '\'wasm-unsafe-eval\'',
    isDev ? '\'unsafe-eval\'' : null,
  ];
  const imgSrc = ['\'self\'', 'data:', 'blob:', 'https://images.unsplash.com', posthogOrigin, ...POSTHOG_HOSTS];
  const connectSrc = [
    '\'self\'',
    supabaseOrigin,
    supabaseRealtimeOrigin,
    supabaseFunctionsOrigin,
    posthogOrigin,
    ...POSTHOG_HOSTS,
    sentryIngestOrigin,
    ...SENTRY_HOSTS,
    // FRESCO-32: client-side leaked-password check (lib/validation/pwned-password.ts).
    'https://api.pwnedpasswords.com',
  ];

  const directives = [
    'default-src \'self\'',
    'base-uri \'self\'',
    'object-src \'none\'',
    'frame-ancestors \'none\'',
    'form-action \'self\'',
    'frame-src \'self\'',
    'manifest-src \'self\'',
    'worker-src \'self\' blob:',
    'font-src \'self\'',
    'style-src \'self\' \'unsafe-inline\'',
    `script-src ${dedupe(scriptSrc).join(' ')}`,
    `img-src ${dedupe(imgSrc).join(' ')}`,
    `connect-src ${dedupe(connectSrc).join(' ')}`,
    'upgrade-insecure-requests',
    reportUri ? `report-uri ${reportUri}` : null,
    reportUri ? 'report-to csp-endpoint' : null,
  ];

  return directives.filter(Boolean).join('; ');
}
