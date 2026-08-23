import { fileURLToPath } from 'node:url';
import { withSentryConfig } from '@sentry/nextjs';

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
};

// ADR-0009: missing authToken (local dev) skips source-map upload, doesn't fail the build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
