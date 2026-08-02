import { NombreForm } from '@/components/profile/nombre-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { getUserNombre, getUserPlan } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/server';

const PLAN_LABELS = { free: 'Plan Free', pro: 'Plan Pro', family: 'Plan Family' } as const;

/**
 * `/profile` — nav item 4. Real session (email) + real tier (`getUserPlan()`,
 * STORY-FRESCO-15), replacing the hardcoded "Laura"/Free placeholder the
 * initial `/project-bootstrap` scaffold left wired up.
 *
 * The upgrade CTA stays a disabled "Próximamente" rather than a live link:
 * payment/self-serve upgrade infra is explicitly deferred past this MVP
 * (`.context/PRD/mvp-scope.md` — Stripe/payment-link handling belongs to
 * the founder's manual concierge-validation process, not to any epic here).
 * A working-looking button with nowhere real to go would be worse than an
 * honest "not yet".
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
    nombre = await getUserNombre(supabase);
  }
  catch (error) {
    // Same conservative fallback as `plan` above: a real read failure falls
    // back to `null` (the form renders empty) rather than crashing the page.
    console.error('[/profile] getUserNombre failed, defaulting to null', error);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h2">Perfil</h1>

      <h2 className="sr-only">Tu cuenta</h2>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{user?.email ?? 'Invitada'}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-body-sm text-tertiary">
          <Tag variant={plan === 'free' ? 'neutral' : 'accent'}>{PLAN_LABELS[plan]}</Tag>
        </CardContent>
      </Card>

      <NombreForm nombreInicial={nombre} />

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
    </div>
  );
}
