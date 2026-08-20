import { ArrowLeft, Bell, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { PaymentFailedNotice } from '@/components/notifications/payment-failed-notice';
import { RecommendedRecipesNotice } from '@/components/notifications/recommended-recipes-notice';
import { RoutesNotice } from '@/components/notifications/routes-notice';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getFavoriteRecipeIds } from '@/lib/api/favorites';
import { getLatestAvailableRecipes } from '@/lib/api/recipes';
import { getPaymentFailedAt, getShouldShowRoutesNotice, getShouldShowWelcomeNotice, getUserPlan, markWelcomeNoticeSeen } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/server';

/** FRESCO-226 AC's "número acotado" (Scope: "ej. 3"). */
const RECOMMENDED_RECIPES_LIMIT = 3;

/**
 * FRESCO-72 — mockup showed "Productos por caducar" (pantry-expiration
 * alerts), but Fresco has no pantry/expiration-tracking feature to source
 * that from (confirmed with the user before building — real notification
 * types are still to be defined, tracked as future work, not invented here).
 * No general notification-generating system exists anywhere in the app yet —
 * `showWelcome` (FRESCO-224), `showRoutes` (FRESCO-225), and
 * `recommendedRecipes` (FRESCO-226) are the first exceptions. FRESCO-234
 * added the first REAL system alert (`paymentFailedAt`, sourced from
 * FRESCO-232's data, already gating `/profile`'s own card) — rendered above
 * the three curated sections since a real alert takes priority. Wire further
 * real notification types/data once that scope is defined.
 */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Same conservative-default judgment call as `/profile`'s reads: a real
  // read failure hides the notice rather than crashing the page — worst case
  // it shows once more on a later visit, never breaks navigation.
  const [plan, paymentFailedAt, showWelcome, showRoutes, recommendedRecipes, favoriteRecipeIds] = await Promise.all([
    getUserPlan(supabase, user?.id).catch((error) => {
      // Same conservative-default judgment call as `/profile`'s read: a real
      // read failure defaults to 'free' (hides the payment-failed notice)
      // rather than crashing the page.
      console.error('[/notifications] getUserPlan failed, defaulting to free', error);
      return 'free' as Awaited<ReturnType<typeof getUserPlan>>;
    }),
    getPaymentFailedAt(supabase, user?.id).catch((error) => {
      // Same conservative-default judgment call as `/profile`'s read: a real
      // read failure hides the aviso rather than crashing the page.
      console.error('[/notifications] getPaymentFailedAt failed, defaulting to null', error);
      return null;
    }),
    getShouldShowWelcomeNotice(supabase, user?.id).catch((error) => {
      console.error('[/notifications] getShouldShowWelcomeNotice failed, defaulting to hidden', error);
      return false;
    }),
    getShouldShowRoutesNotice(supabase, user?.id).catch((error) => {
      console.error('[/notifications] getShouldShowRoutesNotice failed, defaulting to hidden', error);
      return false;
    }),
    getLatestAvailableRecipes(supabase, user?.id, RECOMMENDED_RECIPES_LIMIT).catch((error) => {
      console.error('[/notifications] getLatestAvailableRecipes failed, defaulting to hidden', error);
      return [];
    }),
    getFavoriteRecipeIds(supabase, user?.id).catch((error) => {
      console.error('[/notifications] getFavoriteRecipeIds failed, defaulting to none favorited', error);
      return new Set<string>();
    }),
  ]);

  // Same 'pro' + non-null gate as `/profile`'s payment_failed_notice card
  // (STORY-FRESCO-232) — plan stays 'pro' during Stripe's own retry window.
  const showPaymentFailed = plan === 'pro' && Boolean(paymentFailedAt);

  if (showWelcome) {
    // Marked seen as soon as it's about to render, not on a separate
    // dismiss action — the AC only requires "doesn't come back", and this
    // avoids adding client-side interactivity for a one-time notice.
    await markWelcomeNoticeSeen(supabase, user?.id).catch((error) => {
      console.error('[/notifications] markWelcomeNoticeSeen failed', error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/menu" className={buttonVariants({ variant: 'icon', size: 'sm' })} aria-label="Volver" data-testid="notifications_back_link">
          <ArrowLeft className="size-6" />
        </Link>
        <div>
          <h1 className="text-h2">Centro de Avisos</h1>
          <p className="text-body-sm uppercase text-tertiary">Tus notificaciones</p>
        </div>
      </div>

      {/* FRESCO-234: the real system alert takes priority over curated
          content, so it renders first. */}
      <PaymentFailedNotice paymentFailedAt={showPaymentFailed ? paymentFailedAt : null} />

      {showWelcome && (
        <Card className="mt-6" data-testid="notifications_welcome_card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PartyPopper className="size-5 text-primary" aria-hidden="true" />
              <CardTitle>¡Bienvenida al Centro de Avisos!</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Aquí te iremos avisando de lo importante: recetas que te pueden gustar, las rutas principales de la app y cualquier novedad que valga la pena.
            </CardDescription>
          </CardContent>
        </Card>
      )}

      {showRoutes && <RoutesNotice />}

      <RecommendedRecipesNotice recipes={recommendedRecipes} favoriteRecipeIds={favoriteRecipeIds} />

      {!showPaymentFailed && !showWelcome && !showRoutes && recommendedRecipes.length === 0 && (
        <EmptyState
          className="mt-6"
          data-testid="notifications_empty_state"
          icon={<Bell className="size-8 text-tertiary" aria-hidden="true" />}
          title="Sin notificaciones"
          description="Te avisaremos aquí cuando haya algo nuevo."
        />
      )}
    </div>
  );
}
