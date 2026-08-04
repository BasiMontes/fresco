import { ChevronRight, HelpCircle, Settings, Shield, User as UserIcon } from 'lucide-react';
import { DangerZone } from '@/components/profile/danger-zone';
import { NombreForm } from '@/components/profile/nombre-form';
import { PreferencesForm } from '@/components/profile/preferences-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { getUserDietaryPreferences, getUserNombre, getUserPlan } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/server';

const PLAN_LABELS = { free: 'Plan Free', pro: 'Plan Pro', family: 'Plan Family' } as const;

const AYUDA_ROWS = [
  { icon: Settings, label: 'Configuración' },
  { icon: HelpCircle, label: 'FAQ' },
  { icon: Shield, label: 'Privacidad' },
];

/**
 * `/profile` — nav item 4. Real session (email) + real tier (`getUserPlan()`,
 * STORY-FRESCO-15) + real dietary preferences (`getUserDietaryPreferences()`,
 * FRESCO-70), replacing the original name-tag-only page with a real profile:
 * greeting header, editable preferences, an Ayuda section (inert — see
 * below), and a footer "zona de peligro" with 3 real account actions
 * (`DangerZone`: logout, JSON export, permanent deletion).
 *
 * The upgrade CTA stays a disabled "Próximamente" rather than a live link:
 * payment/self-serve upgrade infra is explicitly deferred past this MVP
 * (`.context/PRD/mvp-scope.md` — Stripe/payment-link handling belongs to
 * the founder's manual concierge-validation process, not to any epic here).
 * A working-looking button with nowhere real to go would be worse than an
 * honest "not yet" — same judgment call now applied to the Ayuda section's 3
 * rows (`Configuración`/`FAQ`/`Privacidad`): none of those sub-pages exist
 * yet, so they render as inert rows rather than dead links.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let plan: Awaited<ReturnType<typeof getUserPlan>> = 'free';
  try {
    plan = await getUserPlan(supabase);
  }
  catch (error) {
    // Same judgment call as every other page reading server-side profile
    // data: a real read failure defaults to the more conservative 'free'
    // (shows the upsell) rather than crashing the page.
    console.error('[/profile] getUserPlan failed, defaulting to free', error);
  }

  let nombre: string | null = null;
  try {
    nombre = await getUserNombre(supabase, user?.id);
  }
  catch (error) {
    // Same conservative fallback as `plan` above: a real read failure falls
    // back to `null` (the form renders empty) rather than crashing the page.
    console.error('[/profile] getUserNombre failed, defaulting to null', error);
  }

  // Same conservative-default judgment call as `plan`/`nombre` above: a real
  // read failure falls back to a safe empty state (`PreferencesForm` still
  // renders, just unchecked) rather than crashing the page or silently
  // hiding the whole section.
  let dietaryPreferences: Awaited<ReturnType<typeof getUserDietaryPreferences>> = {
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
  };
  try {
    dietaryPreferences = await getUserDietaryPreferences(supabase, user?.id);
  }
  catch (error) {
    console.error('[/profile] getUserDietaryPreferences failed, defaulting to empty preferences', error);
  }

  const initial = nombre?.trim().charAt(0).toUpperCase();

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
          <Tag variant={plan === 'free' ? 'neutral' : 'accent'}>{PLAN_LABELS[plan]}</Tag>
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
            <div className="flex flex-col divide-y divide-border">
              {AYUDA_ROWS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  aria-disabled="true"
                  className="flex items-center justify-between gap-2 py-3 text-tertiary first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-2 text-body-md">
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </div>
                  <div className="flex items-center gap-1">
                    <Tag variant="neutral">Próximamente</Tag>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </div>
                </div>
              ))}
            </div>
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

      <Card variant="danger" className="mt-4">
        <CardHeader>
          <CardTitle>Zona de peligro</CardTitle>
        </CardHeader>
        <CardContent>
          <DangerZone email={user?.email ?? ''} />
        </CardContent>
      </Card>
    </div>
  );
}
