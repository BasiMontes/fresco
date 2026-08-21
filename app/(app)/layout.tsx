import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { getUserNombre, getUserPlan, hasUserProfile } from '@/lib/api/user-profile';
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) { redirect('/login'); }

  const [nombre, plan, profileExists] = await Promise.all([
    getUserNombre(supabase, user.id).catch((error) => {
      console.error('[AppGroupLayout] getUserNombre failed, defaulting to null', error);
      return null;
    }),
    getUserPlan(supabase, user.id).catch((error) => {
      console.error('[AppGroupLayout] getUserPlan failed, defaulting to free', error);
      return 'free' as Awaited<ReturnType<typeof getUserPlan>>;
    }),
    // FRESCO-250: fails open (assumes onboarded) on a transient Supabase
    // error, same conservative-default judgment call as the two reads above
    // — the alternative would lock every already-onboarded user out during
    // an outage.
    hasUserProfile(supabase, user.id).catch((error) => {
      console.error('[AppGroupLayout] hasUserProfile failed, defaulting to true', error);
      return true;
    }),
  ]);

  // FRESCO-250: an authenticated user with no `user_profiles` row never
  // finished onboarding (e.g. landed here straight off the signup
  // confirmation email) — steer them back instead of rendering the shell.
  if (!profileExists) { redirect('/onboarding'); }

  return <AppShell user={{ nombre, email: user.email ?? '', plan, isAnonymous: user.is_anonymous ?? false }}>{children}</AppShell>;
}
