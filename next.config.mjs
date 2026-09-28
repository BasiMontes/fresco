import { fileURLToPath } from 'node:url';
// FRESCO-725: @sentry/nextjs 11 moved `withSentryConfig` to its own entry
// point; it's no longer exported from the package root.
import { withSentryConfig } from '@sentry/nextjs/config';

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
  // Pin the workspace root to this repo — a stray lockfile one level up
  // (/Users/basimontes/fresco/package-lock.json, outside this project) would
  // otherwise make Next.js/Turbopack infer the wrong root.
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
  experimental: {
    // FRESCO-723: PageSpeed's "render-blocking resources" audit flagged the
    // global stylesheet (54 KB compressed, synchronous `<link>` in every
    // page's `<head>`). Next's own docs recommend this exact flag for
    // atomic-CSS (Tailwind) sites: inlines the CSS as a `<style>` tag in the
    // HTML instead of a separate blocking request. Trade-off (documented):
    // returning visitors lose the separately-cached stylesheet and
    // re-download it with every HTML response — acceptable here since the
    // whole point is a light, fast first load for new visitors on the
    // landing page. Production builds only; no effect in `next dev`.
    inlineCss: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // FRESCO-462: 20 active recipes source their photo from Pexels; next/image
      // 400s on any hostname not listed here.
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
    // FRESCO-719: Next only emits WebP by default. AVIF is the next real
    // byte-size step over WebP at equivalent visual quality (PageSpeed's
    // "improve image delivery" audit, ~32 KiB estimated saving across the
    // recipe photo grid). Content negotiation via the `Accept` header
    // (already `vary: Accept` on the optimizer response) falls back to
    // WebP for any client that doesn't advertise AVIF support.
    formats: ['image/avif', 'image/webp'],
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
      // FRESCO-724/FRESCO-725: re-tested after the v11 upgrade. We don't use
      // Session Replay or the `debug` option, so these tree-shake safely.
      // NOT setting `excludeTracing`: `tracesSampleRate` in
      // sentry.server.config.ts / sentry.edge.config.ts means performance
      // monitoring is actively used.
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeReplayShadowDom: true,
        excludeReplayIframe: true,
        excludeReplayWorker: true,
      },
    })
  : nextConfig;
