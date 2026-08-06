'use client';

import { LogOut, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

/**
 * Shared shape for the signed-in user's account info (FRESCO-82), threaded
 * through `layout → AppShell → Sidebar → SidebarAccount`. Defined here and
 * re-exported so the 3 consumers don't each redeclare the same object type.
 */
export interface AccountUser {
  /** Display name from `user_profiles.nombre` — `null` when not set yet. */
  nombre: string | null
  /** The signed-in user's email, from `auth.getUser()`. */
  email: string
}

export type SidebarAccountProps = AccountUser;

/**
 * Sidebar footer account block (FRESCO-82): name + email + avatar/initial,
 * plus the logout action, pinned to the bottom of the desktop sidebar via
 * `mt-auto` on the parent `<aside>` (`sidebar.tsx`). Only ever mounted
 * inside `app/(app)/layout.tsx` — `/login` and `/signup` live outside that
 * route group and never render `AppShell`, so no `/login`/`/signup` route
 * can render this component. `Sidebar` additionally skips mounting it when
 * `user` is `null` (no active session — AC scenario 3), so the "no session
 * → no component" guarantee holds even for routes under `(app)/` that
 * somehow render without a resolved user.
 *
 * Logout reuses the exact call sequence already shipped and working in
 * `components/profile/danger-zone.tsx` (`createClient()` browser client →
 * `auth.signOut()` → `router.push('/login')`), duplicated locally rather
 * than extracted into a shared hook — matching this codebase's existing
 * convention of independent local copies of this same 3-line pattern
 * (`danger-zone.tsx`, `app/update-password/page.tsx`).
 */
export function SidebarAccount({ nombre, email }: SidebarAccountProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      const client = createClient();
      await client.auth.signOut();
      router.push('/login');
    }
    catch (error) {
      // Same fallback as `danger-zone.tsx`'s `handleLogout` — a real
      // sign-out failure surfaces inline rather than leaving the user
      // stuck with no feedback.
      console.error('[SidebarAccount] signOut failed', error);
      setLogoutError('No se pudo cerrar sesión. Inténtalo de nuevo.');
      setIsLoggingOut(false);
    }
  }

  const initial = nombre?.trim().charAt(0).toUpperCase();

  return (
    <div data-testid="sidebarAccount" className="mt-auto border-t border-background/10 pt-4">
      <div className="flex items-center gap-3">
        <div
          data-testid="user_avatar"
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-body-md font-semibold text-primary"
        >
          {initial || <UserIcon className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p data-testid="user_name" className="truncate text-body-sm font-semibold text-background">
            {nombre || 'Sin nombre'}
          </p>
          <p data-testid="user_email" className="truncate text-body-sm text-background/70">
            {email}
          </p>
        </div>
        <Button
          type="button"
          variant="icon"
          aria-label="Cerrar sesión"
          data-testid="sidebar_logout_button"
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
          onClick={() => void handleLogout()}
          className="bg-background/10 text-background hover:bg-background/20"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {logoutError && (
        <p data-testid="sidebar_logout_error_message" role="alert" aria-live="assertive" className="mt-2 text-body-sm text-error">
          {logoutError}
        </p>
      )}
    </div>
  );
}
