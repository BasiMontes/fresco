import type { Metadata } from 'next';
import type { ThemePreference } from '@/lib/theme/theme';
import { Figtree, Fraunces } from 'next/font/google';
import { cookies } from 'next/headers';
import { PostHogProvider } from '@/app/providers/posthog-provider';
import { CookieConsentBanner } from '@/components/legal/cookie-consent-banner';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import { CookieSettingsDialog } from '@/components/legal/cookie-settings-dialog';
import { COOKIE_CONSENT_COOKIE, parseCookieConsent } from '@/lib/consent/cookie-consent';
import { isThemePreference, THEME_COOKIE } from '@/lib/theme/theme';

import './globals.css';

// NOT `import '@/bones/registry'` here — confirmed live this session that a
// registry import in the root layout doesn't reach `<Skeleton>` usages in
// other route segments: Next.js App Router gives each 'use client' entry
// point (root layout vs. a route's own loading.tsx) its own client bundle
// under Turbopack, and boneyard-js's bone registry is a plain in-memory
// `Map` in module scope — two separate bundle instances of the same
// `boneyard-js/shared.js` module mean two separate Maps, so bones
// registered from one never show up when read from the other. Each file
// that renders `<Skeleton>` imports the registry itself instead — see
// `app/(app)/menu/loading.tsx` etc.

// DESIGN.md v2 Typography (FRESCO-438): Fraunces (variable display serif) for
// h1/h2 only — weight 400, 300 for `display-light`; SOFT/WONK/opsz axes give it
// bespoke character. Figtree (400/600/700) for body copy AND h3–h6, card titles,
// button labels. Exposed as CSS variables consumed by tailwind.config.ts's
// `fontFamily.heading` / `fontFamily.sans` and the split `h1,h2` / `h3..h6`
// rules in globals.css.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-heading',
  display: 'swap',
});

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'Fresco — Menús semanales que aprenden de lo que realmente cocinas',
  description:
    'Fresco genera tu menú semanal en menos de 30 segundos y aprende de lo que realmente cocinas cada semana.',
};

// FRESCO-386 (A4-M10): the enforcing, nonce-based CSP (see `proxy.ts`) needs
// a per-request nonce stamped onto Next's inline bootstrap script. A page
// prerendered at build time has no request and therefore no nonce, so its
// bootstrap would be blocked by `script-src` (no `'unsafe-inline'`). Forcing
// dynamic rendering app-wide is the documented tradeoff of nonce CSP — no
// CDN caching, no PPR.
export const dynamic = 'force-dynamic';

// FRESCO-448 §Dark mode: the `theme` cookie (`light` | `dark` | `system`) is
// read per request — `dynamic = 'force-dynamic'` above already forces a
// request context — and stamped onto `<html>` server-side, so the correct
// palette paints on first byte with no flash and no inline script. `system`
// is an explicit user choice (follows `prefers-color-scheme`, no `data-theme`
// stamped). First visit — no cookie at all — defaults to `light`, not
// `system`: a clean, predictable first impression regardless of the visitor's
// OS setting.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value as ThemePreference | undefined;
  const theme: ThemePreference = isThemePreference(themeCookie) ? themeCookie : 'light';
  // FRESCO-428: same server-read pattern as `theme` above — reading the
  // consent cookie per request avoids a banner flash on hydration for a
  // returning visitor who already decided.
  const initialConsentDecision = parseCookieConsent(cookieStore.get(COOKIE_CONSENT_COOKIE)?.value);

  return (
    <html
      lang="es"
      data-theme={theme === 'system' ? undefined : theme}
      className={`${fraunces.variable} ${figtree.variable}`}
    >
      <body>
        <CookieConsentProvider initialDecision={initialConsentDecision}>
          <PostHogProvider>{children}</PostHogProvider>
          <CookieConsentBanner />
          <CookieSettingsDialog />
        </CookieConsentProvider>
      </body>
    </html>
  );
}
