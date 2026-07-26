/**
 * Environment-aware URL helpers — single source of truth for the app's own
 * base URL and API base URL, per environment. Mirrors the shape of
 * `.agents/project.yaml`'s `environments:` block (`local`, `staging`).
 *
 * Per project-bootstrap's env-url-setup reference: URLs are known constants,
 * not something to source from `.env` at runtime — env vars add
 * configuration risk for values that never change per deploy. The values
 * below are copied from `.agents/project.yaml` `environments.*.web_url` /
 * `environments.*.api_url`, normalized to full `https://` URLs.
 *
 * NOTE: `.agents/project.yaml` has no `environments.production` block yet
 * (a known, already-flagged gap — see that file's `environments:` comment).
 * `getEnvironment()` deliberately throws if it ever detects a production
 * deploy rather than silently guessing a URL — add the block and extend
 * `APP_URLS` + `AppEnvironment` before wiring VERCEL_ENV=production traffic
 * through this helper.
 */

export const APP_URLS = {
  local: {
    webUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:3000/api',
  },
  staging: {
    webUrl: 'https://fresco-pro.vercel.app',
    apiUrl: 'https://fresco-pro.vercel.app/api',
  },
} as const;

export type AppEnvironment = keyof typeof APP_URLS;

/**
 * Detects the current environment from Vercel's system env var.
 *
 * - No `VERCEL_ENV` → `local` (bare `bun run dev` / local shell)
 * - `VERCEL_ENV=preview` → `staging` (this repo's only non-local deploy target today)
 * - `VERCEL_ENV=production` → throws — see the module doc above.
 */
export function getEnvironment(): AppEnvironment {
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error(
      'getEnvironment(): VERCEL_ENV=production but .agents/project.yaml has no `environments.production` block yet. '
      + 'Add one (web_url, api_url, db_project_ref) and extend lib/urls.ts APP_URLS before serving production traffic through this helper.',
    );
  }

  if (process.env.VERCEL_ENV === 'preview') {
    return 'staging';
  }

  return 'local';
}

/** Returns the app's own base URL (web_url) for the current environment. */
export function getBaseUrl(): string {
  return APP_URLS[getEnvironment()].webUrl;
}

/** Returns the API base URL (api_url) for the current environment. */
export function getApiUrl(): string {
  return APP_URLS[getEnvironment()].apiUrl;
}

/**
 * Builds a full URL from a path against the current environment's base URL.
 *
 * ```ts
 * buildUrl('/auth/callback')
 * // local:   'http://localhost:3000/auth/callback'
 * // staging: 'https://fresco-pro.vercel.app/auth/callback'
 * ```
 */
export function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getBaseUrl()}${normalizedPath}`;
}
