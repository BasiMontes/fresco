/**
 * FRESCO-803 (audit-6 A6-D7) — the build this process was made from, so a
 * Sentry error can be tied to one deploy and a rollback is decided on evidence.
 *
 * `NEXT_PUBLIC_RELEASE` is set in `next.config.mjs` from `VERCEL_GIT_COMMIT_SHA`
 * at build time, which makes it available to the browser bundle too (Vercel's
 * own `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` is not guaranteed in every scope).
 * Server and edge fall back to `VERCEL_GIT_COMMIT_SHA` itself. Outside Vercel
 * (local, CI) there is no release: `undefined` lets the SDK keep its default.
 */
interface ReleaseEnv {
  NEXT_PUBLIC_RELEASE?: string | undefined
  VERCEL_GIT_COMMIT_SHA?: string | undefined
}

export function resolveRelease(env: ReleaseEnv): string | undefined {
  const release = (env.NEXT_PUBLIC_RELEASE || env.VERCEL_GIT_COMMIT_SHA || '').trim();
  return release === '' ? undefined : release;
}

/**
 * Written with the literal `process.env.X` accesses on purpose: Next inlines
 * `NEXT_PUBLIC_*` only when it can see them, so passing `process.env` whole
 * would leave the client bundle without a release.
 */
export function sentryRelease(): string | undefined {
  return resolveRelease({
    NEXT_PUBLIC_RELEASE: process.env.NEXT_PUBLIC_RELEASE,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
  });
}
