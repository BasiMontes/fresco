import { fileURLToPath } from 'node:url';
import { withSentryConfig } from '@sentry/nextjs';

// --- FRESCO-312 / FRESCO-386: security response headers -------------------
// The request-independent headers live here as a static block. The
// Content-Security-Policy moved to `proxy.ts` (FRESCO-386 / A4-M10): it is
// now enforcing with a per-request nonce, which a static config header
// cannot carry. `lib/security/csp.ts` builds it.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

// FRESCO-366 / A4-B4: PostHog reverse proxy. `posthog-js` posts to the
// same-origin `/ingest` path (see app/providers/posthog-provider.tsx) and
// these rewrites forward it to PostHog's ingestion + static-asset hosts, so
// an ad-blocker filtering `*.posthog.com` can't drop client events. Region
// follows NEXT_PUBLIC_POSTHOG_HOST (`https://eu.i.posthog.com` →
// `https://eu-assets.i.posthog.com`); the rewrites are skipped entirely when
// the host is unset (local dev without a PostHog project).
function toOrigin(url) {
  try {
    return new URL(url).origin;
  }
  catch {
    return null;
  }
}

const posthogIngestHost = toOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST);
const posthogAssetsHost = posthogIngestHost?.replace('.i.posthog.com', '-assets.i.posthog.com') ?? null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // FRESCO-245: enable React's <ViewTransition> integration so route
  // navigations under `(app)/` cross-fade instead of hard-cutting. The
  // browser View Transitions API degrades to an instant swap where it is
  // unsupported, and browser-initiated back/forward navigations are covered
  // natively. Opt-in per subtree via the `<ViewTransition>` wrapper in
  // `components/layout/app-shell.tsx`; the CSS lives in `app/globals.css`.
  experimental: {
    viewTransition: true,
  },
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
  // FRESCO-366: PostHog sends `/ingest/...` with no trailing slash — without
  // this Next would 308-redirect those requests and the SDK would follow to
  // a URL PostHog rejects.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
    ];
  },
  async rewrites() {
    if (!posthogIngestHost || !posthogAssetsHost) {
      return [];
    }
    return [
      { source: '/ingest/static/:path*', destination: `${posthogAssetsHost}/static/:path*` },
      { source: '/ingest/:path*', destination: `${posthogIngestHost}/:path*` },
    ];
  },
};

// ADR-0009: `withSentryConfig` is BUILD-time tooling only (source-map upload,
// release injection, the debug-id post-compile pass). Runtime error reporting
// lives in `instrumentation*.ts` + `sentry.*.config.ts` and does not depend on
// this wrapper. Apply it only on Vercel: the GitHub Actions e2e build (whose
// `.env` carries the Sentry vars) was hanging in `runAfterProductionCompile`
// past the job's build-wait timeout (FRESCO-361), and that build is a
// throwaway that never needs source maps or a release.
export default process.env.VERCEL
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
    })
  : nextConfig;
