import { AppearanceCard } from '@/components/profile/appearance-card';
import { MenuHistoryCard } from '@/components/profile/menu-history-card';
import { NombreForm } from '@/components/profile/nombre-form';
import { ProfileAccountCards } from '@/components/profile/profile-account-cards';
import { ProfileIdentityCard } from '@/components/profile/profile-identity-card';
import { ProfilePlanCards } from '@/components/profile/profile-plan-cards';
import { ProfilePreferencesAndHelp } from '@/components/profile/profile-preferences-and-help';
import { PushNotificationsToggle } from '@/components/profile/push-notifications-toggle';
import { getAuthUser } from '@/lib/auth/current-user';
import { getProPrices } from '@/lib/billing/pro-prices';
import { PLAN_LABELS } from '@/lib/plan-labels';
import { loadProfilePageData } from '@/lib/profile/load-profile-page-data';
import { createClient } from '@/lib/supabase/server';

/**
 * `/profile` — nav item 4. Real session (email) + real tier (`getUserPlan()`,
 * STORY-FRESCO-15) + real dietary preferences (`getUserDietaryPreferences()`,
 * FRESCO-70), replacing the original name-tag-only page with a real profile:
 * greeting header, editable preferences, an Ayuda section (see below), a
 * "Cuenta" card (`AccountActions`: logout, CSV export), and a footer "zona
 * de peligro" (`DangerZone`, FRESCO-220) scoped to permanent deletion only —
 * the one genuinely destructive action.
 *
 * The upgrade CTA (`UpgradeToProButton`, STORY-FRESCO-228) is now a live
 * Stripe Checkout redirect — self-serve payment, reversing the earlier
 * manual-concierge-collection posture (see `.context/business/business-model.md`
 * Revenue Streams). Architecture is ADR-0007 (`.context/ADR/`): Stripe
 * Checkout hosted, `subscription` mode, `POST /api/stripe/checkout` creates
 * the session and this page only ever redirects to it — `plan` itself is
 * written exclusively by the webhook (`POST /api/stripe/webhook`), never by
 * this page or the client. That same "don't fake it" judgment call is why
 * the Ayuda section's 3 rows (`Configuración`/`FAQ`/`Privacidad`) are now real modals
 * (`AyudaSection`) instead of the inert "Próximamente" rows they used to be:
 * `Privacidad` reuses the existing `LegalModal` as-is, and `Configuración`/
 * `FAQ` follow that same modal pattern rather than becoming full page routes.
 *
 * FRESCO-809 — reads live in `loadProfilePageData`, each card group in
 * `components/profile/profile-*`; this page only wires them together.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  // FRESCO-483: shared verified session read (React.cache) — no extra GoTrue round trip.
  const { data: { user } } = await getAuthUser();

  const { plan, paymentFailedAt, nombre, dietaryPreferences, pastWeeks, trialAvailable } = await loadProfilePageData(supabase, user?.id);
  // FRESCO-871: only the Free upsell shows prices, so Pro users never pay for the Stripe read.
  const prices = plan === 'free' ? await getProPrices() : null;

  // `user.created_at` comes back from `auth.getUser()` above — no extra
  // query. Formatted with `Intl.DateTimeFormat` (no date-formatting utility
  // exists yet in this repo; `lib/date/iso-week.ts` is ISO-week-string math,
  // not a human-readable formatter) rather than hand-rolling a new one.
  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(user.created_at))
    : null;

  const isAnonymous = user?.is_anonymous ?? false;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-h2">Perfil</h1>

      <ProfileIdentityCard nombre={nombre} email={user?.email} isAnonymous={isAnonymous} plan={plan} />

      <NombreForm nombreInicial={nombre} />

      {/* FRESCO-241 PR2: browser-only state (Notification.permission,
          PushSubscription), so this stays client-rendered rather than
          server-read like the cards around it — same reasoning as why
          NombreForm/PreferencesForm are themselves 'use client'. */}
      <PushNotificationsToggle isGuest={isAnonymous} />

      <AppearanceCard />

      <ProfilePreferencesAndHelp
        dietaryPreferences={dietaryPreferences}
        email={user?.email ?? 'Invitada'}
        planLabel={PLAN_LABELS[plan]}
        memberSince={memberSince}
      />

      <MenuHistoryCard weeks={pastWeeks} plan={plan} />

      <ProfilePlanCards plan={plan} paymentFailedAt={paymentFailedAt} trialAvailable={trialAvailable} prices={prices} />

      <ProfileAccountCards email={user?.email ?? ''} isAnonymous={isAnonymous} />
    </div>
  );
}
