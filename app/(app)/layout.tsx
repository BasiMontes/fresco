import { AppShell } from '@/components/layout/app-shell';
import { getUserNombre } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/server';

/**
 * Fetches the signed-in user's account info once here (FRESCO-82) — every
 * route under `(app)/` funnels through this one layout, so a single
 * server-side fetch avoids a duplicate `auth.getUser()`/`getUserNombre()`
 * round trip per page. Same conservative-default fallback as
 * `/profile/page.tsx`: a `getUserNombre` read failure degrades to `null`
 * (sidebar footer falls back to the icon avatar) rather than crashing the
 * whole authenticated shell. When `auth.getUser()` itself returns no user
 * (no active session), `AppShell` gets `user: null` — `Sidebar` then skips
 * mounting `SidebarAccount` entirely instead of showing it with a blank
 * identity and a still-active logout button.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const nombre = await getUserNombre(supabase, user?.id).catch((error) => {
    console.error('[AppGroupLayout] getUserNombre failed, defaulting to null', error);
    return null;
  });

  return <AppShell user={user ? { nombre, email: user.email ?? '' } : null}>{children}</AppShell>;
}
