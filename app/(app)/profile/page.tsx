import { User as UserIcon } from 'lucide-react';
import { AyudaSection } from '@/components/profile/ayuda-section';
import { AccountActions, DangerZone } from '@/components/profile/danger-zone';
import { NombreForm } from '@/components/profile/nombre-form';
import { PreferencesForm } from '@/components/profile/preferences-form';
import { UpgradeToProButton } from '@/components/profile/upgrade-to-pro-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { getUserDietaryPreferences, getUserNombre, getUserPlan } from '@/lib/api/user-profile';
import { getPlanTagVariant, PLAN_LABELS } from '@/lib/plan-labels';
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
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // The three reads below are mutually independent — run them concurrently
  // rather than paying for 3 sequential round trips. Each keeps its own
  // fallback via `.catch()` (same conservative-default judgment calls as
  // before) so one call's rejection can't take the others down with it.
  const [plan, nombre, dietaryPreferences] = await Promise.all([
    getUserPlan(supabase, user?.id).catch((error) => {
      // Same judgment call as every other page reading server-side profile
      // data: a real read failure defaults to the more conservative 'free'
      // (shows the upsell) rather than crashing the page.
      console.error('[/profile] getUserPlan failed, defaulting to free', error);
      return 'free' as Awaited<ReturnType<typeof getUserPlan>>;
    }),
    getUserNombre(supabase, user?.id).catch((error) => {
      // Same conservative fallback as `plan` above: a real read failure falls
      // back to `null` (the form renders empty) rather than crashing the page.
      console.error('[/profile] getUserNombre failed, defaulting to null', error);
      return null;
    }),
    getUserDietaryPreferences(supabase, user?.id).catch((error) => {
      // Same conservative-default judgment call as `plan`/`nombre` above: a
      // real read failure falls back to a safe empty state (`PreferencesForm`
      // still renders, just unchecked) rather than crashing the page or
      // silently hiding the whole section.
      console.error('[/profile] getUserDietaryPreferences failed, defaulting to empty preferences', error);
      return {
        num_personas: 2,
        adultos: 2,
        ninos: 0,
        dieta_vegetariano: false,
        dieta_vegano: false,
        dieta_sin_gluten: false,
        dieta_sin_lactosa: false,
        dieta_sin_huevo: false,
        dieta_keto: false,
        dieta_halal: false,
        alergenos: [],
        ingredientes_odiados: [],
        cocinas_favoritas: [],
      } as Awaited<ReturnType<typeof getUserDietaryPreferences>>;
    }),
  ]);

  const initial = nombre?.trim().charAt(0).toUpperCase();

  // `user.created_at` comes back from `auth.getUser()` above — no extra
  // query. Formatted with `Intl.DateTimeFormat` (no date-formatting utility
  // exists yet in this repo; `lib/date/iso-week.ts` is ISO-week-string math,
  // not a human-readable formatter) rather than hand-rolling a new one.
  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(user.created_at))
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-h2">Perfil</h1>

      <h2 className="sr-only">Tu cuenta</h2>
      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-h5 text-background"
            >
              {initial || <UserIcon className="size-6" />}
            </div>
            <div>
              <p className="text-h5">
                Hola
                {nombre ? `, ${nombre}` : ''}
              </p>
              {/* FRESCO-218: reflect the onboarding identity choice
                  (FRESCO-197) here — a guest sees a plain "Invitada" badge
                  (no email exists to show), an upgraded/registered user sees
                  her real email plus a masked password row. The dots are a
                  fixed placeholder, never the real password — Supabase never
                  exposes it, hashed or otherwise; this is purely a visual
                  confirmation that credentials are set. */}
              {user?.is_anonymous
                ? (
                    <Tag data-testid="profile_identity_guest_tag" variant="neutral" className="mt-1">
                      Invitada
                    </Tag>
                  )
                : (
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      <p data-testid="profile_identity_email" className="text-body-sm text-tertiary">{user?.email}</p>
                      <p data-testid="profile_identity_password_masked" className="text-body-sm tracking-widest text-tertiary">••••••••</p>
                    </div>
                  )}
            </div>
          </div>
          <Tag variant={getPlanTagVariant(plan)}>{PLAN_LABELS[plan]}</Tag>
        </div>
      </Card>

      <NombreForm nombreInicial={nombre} />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preferencias</CardTitle>
          </CardHeader>
          <CardContent>
            <PreferencesForm initialPreferences={dietaryPreferences} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ayuda</CardTitle>
          </CardHeader>
          <CardContent>
            <AyudaSection
              email={user?.email ?? 'Invitada'}
              planLabel={PLAN_LABELS[plan]}
              memberSince={memberSince}
            />
          </CardContent>
        </Card>
      </div>

      {plan === 'free' && (
        <Card variant="pro" className="mt-4">
          <CardHeader>
            <CardTitle>Pásate a Fresco Pro</CardTitle>
          </CardHeader>
          <CardContent className="text-body-sm text-tertiary">
            Con Pro, cada menú aprende de lo que cocinas y descartas la semana anterior — cuanto
            más lo uses, menos tienes que pensar. 7 días de prueba gratis, sin tarjeta. Después,
            €4.99/mes.
          </CardContent>
          <div className="mt-3">
            <UpgradeToProButton />
          </div>
        </Card>
      )}

      {/* FRESCO-220: logout + CSV export moved out of the danger-styled
          card below — neither is a destructive action. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountActions />
        </CardContent>
      </Card>

      <Card variant="danger" className="mt-4">
        <CardHeader>
          <CardTitle>Zona de peligro</CardTitle>
        </CardHeader>
        <CardContent>
          <DangerZone email={user?.email ?? ''} isAnonymous={user?.is_anonymous ?? false} />
        </CardContent>
      </Card>
    </div>
  );
}
