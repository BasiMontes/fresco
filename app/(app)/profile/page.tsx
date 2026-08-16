import { User as UserIcon } from 'lucide-react';
import { AyudaSection } from '@/components/profile/ayuda-section';
import { AccountActions, DangerZone } from '@/components/profile/danger-zone';
import { NombreForm } from '@/components/profile/nombre-form';
import { PreferencesForm } from '@/components/profile/preferences-form';
import { Button } from '@/components/ui/button';
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
 * The upgrade CTA stays a disabled "Próximamente" rather than a live link:
 * payment/self-serve upgrade infra is explicitly deferred past this MVP
 * (`.context/PRD/mvp-scope.md` — Stripe/payment-link handling belongs to
 * the founder's manual concierge-validation process, not to any epic here).
 * A working-looking button with nowhere real to go would be worse than an
 * honest "not yet" — that same judgment call is why the Ayuda section's 3
 * rows (`Configuración`/`FAQ`/`Privacidad`) are now real modals
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
              <p className="text-body-sm text-tertiary">{user?.email ?? 'Invitada'}</p>
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
            más lo uses, menos tienes que pensar.
          </CardContent>
          <div className="mt-3">
            <Button variant="action" disabled>
              Próximamente
            </Button>
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
