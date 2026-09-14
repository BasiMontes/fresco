'use client';

import type { UserProfile } from '@schemas';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GuestLogoutDialog } from '@/components/layout/guest-logout-dialog';
import { UpgradeToProButton } from '@/components/profile/upgrade-to-pro-button';
import { Button } from '@/components/ui/button';
import { PLAN_LABELS } from '@/lib/plan-labels';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * FRESCO-510 — public-facing app version, deliberately NOT read from
 * `package.json`. The internal semver (`0.1.0`) doesn't match this
 * marketing-facing string, and coupling them would surprise whoever bumps
 * the package version expecting it to stay internal.
 */
const APP_VERSION_LABEL = 'FRESCO APP V1.0';

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
  /** The signed-in user's subscription tier (FRESCO-84), from `getUserPlan()`. */
  plan: UserProfile['plan']
  /** Whether this is a guest session (`user.is_anonymous`), from `auth.getUser()`. */
  isAnonymous: boolean
}

export interface SidebarAccountProps extends AccountUser {
  /**
   * FRESCO-485 — collapsed rail: drop the upsell card, name / plan label,
   * and version text, keep just the avatar and the logout control, stacked
   * and centred.
   */
  collapsed?: boolean
}

/**
 * Sidebar footer account block (FRESCO-82): a conditional Pro-trial upsell
 * section (FRESCO-510, `plan === 'free'` only — border-less, a bottom
 * hairline instead of a boxed card per the FRESCO-510 amendment: it reads
 * as another footer section, not a card nested inside a footer), then
 * name + plan + avatar/initial, the logout action, and the app version
 * label. Sits at the bottom of the desktop sidebar inside the `mt-auto`
 * footer group (`sidebar.tsx`) — the theme toggle that used to live above
 * it moved to `/profile`'s `AppearanceCard` (FRESCO-510 amendment), so this
 * is now the sidebar footer's only content. Only ever mounted
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
export function SidebarAccount({ nombre, plan, isAnonymous, collapsed = false }: SidebarAccountProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  // FRESCO-90: a guest's logout is functionally "delete my generated menu"
  // (the anonymous session IS the account) — gated behind a confirmation
  // dialog instead of firing immediately, unlike a real account's logout
  // (100% safe/reversible, no gate needed).
  const [showGuestConfirm, setShowGuestConfirm] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      const client = createClient();
      await client.auth.signOut();
      // FRESCO-150: sessionStorage isn't scoped per-account — clear any
      // onboarding draft so it doesn't leak into whoever logs in next on
      // this browser tab.
      useOnboardingStore.getState().reset();
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
  // FRESCO-510 — the trial upsell only makes sense for a user who isn't
  // already paying; pro/family are already the outcome this card sells.
  const showProUpsell = plan === 'free' && !isAnonymous;

  return (
    <div
      data-testid="sidebarAccount"
      className={cn('flex flex-col gap-4 border-t border-background/10 pt-4', collapsed && 'items-center')}
    >
      {showProUpsell && !collapsed && (
        <div data-testid="sidebar_pro_upsell_card" className="flex flex-col gap-3 border-b border-background/10 pb-4">
          <div>
            <h3 className="text-h5 text-background">Prueba Pro gratis</h3>
            <p className="mt-1 text-body-sm text-background/70">7 días para que el menú te conozca.</p>
          </div>
          <UpgradeToProButton />
        </div>
      )}

      <div className={cn('flex items-start gap-3', collapsed && 'flex-col items-center gap-3')}>
        <div
          data-testid="user_avatar"
          aria-hidden="true"
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-body-md font-semibold text-primary"
        >
          {initial || <UserIcon className="size-4" />}
        </div>
        <div className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
          <p data-testid="user_name" className="truncate text-label text-background">
            {nombre || 'Sin nombre'}
          </p>
          <p data-testid="plan_label" className="mt-0.5 truncate text-caption text-background/70">
            {PLAN_LABELS[plan]}
          </p>
        </div>
        <Button
          type="button"
          variant="icon"
          aria-label={isAnonymous ? 'Cerrar sesión (perderás tu menú generado)' : 'Cerrar sesión'}
          data-testid="sidebar_logout_button"
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
          onClick={() => (isAnonymous ? setShowGuestConfirm(true) : void handleLogout())}
          className="mt-0.5 shrink-0 bg-background/10 text-background hover:bg-background/20"
        >
          <LogOut className="size-6" aria-hidden="true" />
        </Button>
      </div>
      {logoutError && (
        <p data-testid="sidebar_logout_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
          {logoutError}
        </p>
      )}
      {!collapsed && (
        <p data-testid="sidebar_app_version" className="text-center text-caption text-background/50">
          {APP_VERSION_LABEL}
        </p>
      )}
      {isAnonymous && (
        <GuestLogoutDialog
          open={showGuestConfirm}
          onOpenChange={setShowGuestConfirm}
          isLoggingOut={isLoggingOut}
          onConfirm={() => {
            setShowGuestConfirm(false);
            void handleLogout();
          }}
        />
      )}
    </div>
  );
}
