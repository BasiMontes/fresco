'use client';

import type { UserProfile } from '@schemas';
import { LogOut, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GuestLogoutDialog } from '@/components/layout/guest-logout-dialog';
import { UpgradeToProButton } from '@/components/profile/upgrade-to-pro-button';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
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
 * Sidebar footer account block (FRESCO-82). FRESCO-514 collapsed the
 * previously-flat footer row into a popover-triggered menu: the identity
 * row (avatar/initial + name + plan) is the trigger, and clicking it opens
 * a `Popover` panel — repeating the identity row for context (the trigger
 * itself only shows the avatar in `collapsed` mode), then "Mejorar plan"
 * (FRESCO-513, `plan === 'free'` only), "Perfil", "Configuración" (scrolls
 * `/profile` to `AyudaSection`'s Configuración row), "Ayuda" (scrolls
 * `/profile` to the Ayuda card), and "Cerrar sesión" last. `Perfil` no
 * longer lives as its own top-nav item (`sidebar.tsx`) — this popover is
 * now its only entry point from the sidebar. Sits at the bottom of the
 * desktop sidebar inside the `mt-auto` footer group (`sidebar.tsx`) — the
 * theme toggle that used to live above it moved to `/profile`'s
 * `AppearanceCard` (FRESCO-510 amendment), so this is now the sidebar
 * footer's only content. Only ever mounted
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
  // FRESCO-514: the account footer is now the trigger for a popover menu.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  function closeMenuThen(action: () => void) {
    setIsMenuOpen(false);
    action();
  }

  return (
    <div
      data-testid="sidebarAccount"
      className={cn('flex flex-col gap-5 border-t border-background/10 pt-5', collapsed && 'items-center')}
    >
      <div className="relative">
        <button
          type="button"
          data-testid="sidebar_account_trigger"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(current => !current)}
          className={cn(
            'flex items-center gap-3 rounded-card text-left transition-colors hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-primary',
            collapsed ? 'rounded-full p-0' : 'w-full p-1',
          )}
        >
          <span
            data-testid="user_avatar"
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-body-md font-semibold text-primary"
          >
            {initial || <UserIcon className="size-4" />}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <p data-testid="user_name" className="truncate text-label text-background">
                {nombre || 'Sin nombre'}
              </p>
              <p data-testid="plan_label" className="mt-0.5 truncate text-caption text-background/70">
                {PLAN_LABELS[plan]}
              </p>
            </span>
          )}
        </button>

        <Popover
          open={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          aria-label="Menú de cuenta"
          data-testid="sidebar_account_popover"
          className="inset-x-0 bottom-full mb-2 w-64"
        >
          {/* Identity row, repeated — in `collapsed` mode the trigger above
              shows only the avatar, so this is the only place name/plan are
              visible until the panel is opened. */}
          <div className="flex items-center gap-3 px-3 py-2">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-body-md font-semibold text-on-brand">
              {initial || <UserIcon className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <p className="truncate text-label text-text">{nombre || 'Sin nombre'}</p>
              <p className="mt-0.5 truncate text-caption text-tertiary">{PLAN_LABELS[plan]}</p>
            </span>
          </div>

          <div role="separator" className="my-1 border-t border-border" />

          {showProUpsell && (
            <div className="px-2 py-1">
              <UpgradeToProButton label="Mejorar plan" size="sm" className="w-full" />
            </div>
          )}

          <Link
            href="/profile"
            role="menuitem"
            data-testid="popover_item_perfil"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center rounded-card px-3 py-2 text-body-md text-text hover:bg-neutral-100"
          >
            Perfil
          </Link>

          <Link
            href="/profile#ayuda-configuracion"
            role="menuitem"
            data-testid="popover_item_configuracion"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center rounded-card px-3 py-2 text-body-md text-text hover:bg-neutral-100"
          >
            Configuración
          </Link>

          <div role="separator" className="my-1 border-t border-border" />

          <Link
            href="/profile#ayuda"
            role="menuitem"
            data-testid="popover_item_ayuda"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center rounded-card px-3 py-2 text-body-md text-text hover:bg-neutral-100"
          >
            Ayuda
          </Link>

          <Button
            type="button"
            variant="ghost"
            role="menuitem"
            aria-label={isAnonymous ? 'Cerrar sesión (perderás tu menú generado)' : 'Cerrar sesión'}
            data-testid="sidebar_logout_button"
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
            onClick={() => closeMenuThen(() => (isAnonymous ? setShowGuestConfirm(true) : void handleLogout()))}
            className="w-full justify-start gap-2 px-3 text-error hover:bg-neutral-100"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </Button>
        </Popover>
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
