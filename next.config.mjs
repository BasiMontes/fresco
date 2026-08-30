import { fileURLToPath } from 'node:url';
import { withSentryConfig } from '@sentry/nextjs';

// --- FRESCO-312: security response headers ---------------------------------
// Production previously served only `Strict-Transport-Security`, and only
// because Vercel auto-injects it on `*.vercel.app`. This block adds the rest
// (and makes HSTS explicit so a future custom domain keeps it) plus a
// Content-Security-Policy in Report-Only mode.
//
// CSP is Report-Only and nonce-less on purpose: a nonce forces every page
// into dynamic rendering (no CDN caching — see the Next.js CSP guide), which
// is not warranted for a medium-severity finding. `script-src`/`style-src`
// therefore keep `'unsafe-inline'` — without a nonce there is no other way to
// allow Next.js's own inline bootstrap, and Report-Only blocks nothing
// anyway. The follow-up (separate ticket) is: add a nonce and flip CSP to
// enforcing once Sentry shows the report stream is quiet.

/** `https://host[:port]` of a URL string, or null when unparseable/unset. */
function toOrigin(url) {
  try {
    return new URL(url).origin;
  }
  catch {
    return null;
  }
}

/**
 * Sentry's Security Header (CSP) report endpoint, derived from the public
 * DSN `https://<key>@<host>/<projectId>`:
 * `https://<host>/api/<projectId>/security/?sentry_key=<key>`.
 */
function sentryCspReportUri(dsn) {
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

const supabaseOrigin = toOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseFunctionsOrigin = toOrigin(process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL);
const supabaseRealtimeOrigin = supabaseOrigin?.replace(/^https:/, 'wss:') ?? null;
const posthogOrigin = toOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST);
const sentryIngestOrigin = toOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN);
const cspReportUri = sentryCspReportUri(process.env.NEXT_PUBLIC_SENTRY_DSN);

// Third parties the browser actually talks to. Stripe is intentionally absent:
// checkout is a server-side call + full-page redirect to Stripe's hosted page,
// so the browser never loads Stripe.js.
const scriptSrc = ['\'self\'', '\'unsafe-inline\'', posthogOrigin, 'https://*.posthog.com'];
const imgSrc = ['\'self\'', 'data:', 'blob:', 'https://images.unsplash.com', posthogOrigin];
const connectSrc = [
  '\'self\'',
  supabaseOrigin,
  supabaseRealtimeOrigin,
  supabaseFunctionsOrigin,
  posthogOrigin,
  'https://*.posthog.com',
  sentryIngestOrigin,
  'https://*.ingest.sentry.io',
  'https://*.ingest.us.sentry.io',
  'https://*.ingest.de.sentry.io',
];

const tokens = list => [...new Set(list.filter(Boolean))].join(' ');

const contentSecurityPolicy = [
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
  `script-src ${tokens(scriptSrc)}`,
  `img-src ${tokens(imgSrc)}`,
  `connect-src ${tokens(connectSrc)}`,
  'upgrade-insecure-requests',
  cspReportUri && `report-uri ${cspReportUri}`,
  cspReportUri && 'report-to csp-endpoint',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
  ...(cspReportUri
    ? [{ key: 'Reporting-Endpoints', value: `csp-endpoint="${cspReportUri}"` }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this repo — a stray lockfile one level up
  // (/Users/basimontes/fresco/package-lock.json, outside this project) would
  // otherwise make Next.js/Turbopack infer the wrong root.
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  // ADR-0009: force-expose VERCEL_ENV to the client, independent of Vercel's project toggle.
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
    ];
  },
};

// ADR-0009: missing authToken (local dev) skips source-map upload, doesn't fail the build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
