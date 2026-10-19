import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { ServiceWorkerRegistrar } from '@/components/layout/service-worker-registrar';
import { ReconsentDialog } from '@/components/legal/reconsent-dialog';
import { getUserNombre, getUserPlan, hasUserProfile } from '@/lib/api/user-profile';
import { getAuthUser } from '@/lib/auth/current-user';
import { loginUrlFor } from '@/lib/auth/login-redirect';
import { parseSidebarCollapsed, SIDEBAR_COLLAPSED_COOKIE } from '@/lib/layout/sidebar-preference';
import { getMissingConsents } from '@/lib/legal/consent-status';
import { createClient } from '@/lib/supabase/server';

/**
 * Fetches the signed-in user's account info once here (FRESCO-82) — every
 * route under `(app)/` funnels through this one layout, so a single
 * server-side fetch avoids a duplicate `auth.getUser()`/`getUserNombre()`
 * round trip per page. Same conservative-default fallback as
 * `/profile/page.tsx`: a `getUserNombre` read failure degrades to `null`
 * (sidebar footer falls back to the icon avatar) rather than crashing the
 * whole authenticated shell.
 *
 * FRESCO-83: `auth.getUser()` returning no user means no active session at
 * all (Guest Mode has an anonymous Supabase session, so `user` is still
 * truthy there) — redirect to `/login` instead of rendering the shell with
 * degraded/empty data, which is what every route under `(app)/` used to do.
 *
 * `getUserPlan` (FRESCO-84) is fetched in parallel with `getUserNombre` —
 * the two reads are mutually independent, so there's no reason to pay for
 * two sequential round trips. Same conservative-default fallback as
 * `/profile/page.tsx`: a read failure degrades to `'free'` rather than
 * crashing the shell.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // FRESCO-483: one verified session read per render, shared with the page
  // and any `lib/api/*` helper called without an explicit `userId`.
  const { data: { user } } = await getAuthUser();

  if (!user) { redirect(loginUrlFor((await headers()).get('x-pathname'))); }

  const [nombre, plan, profileExists, missingConsents] = await Promise.all([
    getUserNombre(supabase, user.id).catch((error) => {
      console.error('[AppGroupLayout] getUserNombre failed, defaulting to null', error);
      return null;
    }),
    getUserPlan(supabase, user.id).catch((error) => {
      console.error('[AppGroupLayout] getUserPlan failed, defaulting to free', error);
      return 'free' as const;
    }),
    // FRESCO-250: fails open (assumes onboarded) on a transient Supabase
    // error, same conservative-default judgment call as the two reads above
    // — the alternative (fail-closed) would bounce every already-onboarded
    // user to /onboarding during an outage, which is worse than the fail-open
    // exposure: Next.js's Client Router Cache can keep a bad "onboarded"
    // verdict from a blip on a genuinely new user's first load for up to its
    // stale-time window on client-side navigations within (app)/, but a full
    // navigation or reload re-runs this check and self-corrects.
    hasUserProfile(supabase, user.id).catch((error) => {
      console.error('[AppGroupLayout] hasUserProfile failed, defaulting to true', error);
      return true;
    }),
    // FRESCO-1007: a registered user who has not accepted the CURRENT Terms, Privacy Policy and age
    // confirmation is asked again, in a dialog that blocks the screen. A guest never accepted them
    // (they are given when an account is created), so the question is only for a registered user.
    // Fails open: a database blip must not lock every user out of the app.
    user.is_anonymous
      ? Promise.resolve([])
      : getMissingConsents(supabase).catch((error) => {
          console.error('[AppGroupLayout] getMissingConsents failed, not asking', error);
          return [];
        }),
  ]);

  // FRESCO-250: an authenticated user with no `user_profiles` row never
  // finished onboarding (e.g. landed here straight off the signup
  // confirmation email) — steer them back instead of rendering the shell.
  if (!profileExists) { redirect('/onboarding'); }

  // FRESCO-485: same cookie-read pattern as the theme in the root layout —
  // the desktop rail renders at the right width on the first byte.
  const cookieStore = await cookies();
  const sidebarCollapsed = parseSidebarCollapsed(cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value);

  return (
    <>
      {/* FRESCO-979: offline screen for every signed-in user. */}
      <ServiceWorkerRegistrar />
      {missingConsents.length > 0 && <ReconsentDialog />}
      <AppShell
        user={{ nombre, email: user.email ?? '', plan, isAnonymous: user.is_anonymous ?? false }}
        sidebarCollapsed={sidebarCollapsed}
      >
        {children}
      </AppShell>
    </>
  );
}
