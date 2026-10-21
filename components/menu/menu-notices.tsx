import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { MarkedDish } from '@/lib/menu/pro-would-have-excluded';
import Link from 'next/link';
import { LearningExplanationViewed } from '@/components/menu/learning-explanation-viewed';
import { ProWouldHaveExcludedNotice } from '@/components/menu/pro-would-have-excluded-notice';
import { AlertBanner } from '@/components/ui/alert-banner';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface MenuNoticesProps {
  plan: MenuSemanalPersistido
  isAnonymous: boolean
  /** FRESCO-1027: dishes of this menu that Pro would not have served again (Free only, empty otherwise). */
  proPreview: readonly MarkedDish[]
}

/** Guest "save your menu" banner, plan warnings, the Pro preview for Free and the learning explanation for Pro, in that order. */
export function MenuNotices({ plan, isAnonymous, proPreview }: MenuNoticesProps) {
  if (!(isAnonymous || (plan.advertencias && plan.advertencias.length > 0) || plan.explicacionAprendizaje || proPreview.length > 0)) {
    return null;
  }

  return (
    <div className="space-y-4">
      {isAnonymous && (
        <Card data-testid="guest_save_menu_banner" className="border-2 border-primary">
          <CardContent className="flex flex-col items-start gap-3 text-body-sm sm:flex-row sm:items-center sm:justify-between">
            <p>Crea una cuenta para no perder este menú.</p>
            <Link href="/signup" className={buttonVariants({ variant: 'action' })}>
              Guardar mi menú
            </Link>
          </CardContent>
        </Card>
      )}

      <AlertBanner
        advertencias={plan.advertencias}
        data-testid="menu_advertencias_banner"
      />

      <ProWouldHaveExcludedNotice dishes={proPreview} />

      {/*
       * STORY-FRESCO-22 (FR-5.5): real data now, not the hardcoded mock
       * FRESCO-21 removed. `explicacionAprendizaje` is populated server-side
       * only for Pro users with real history (generate-meal-plan/index.ts) —
       * its mere presence here is proof that gate already passed, so no
       * client-side `isPro` re-check is needed.
       */}
      {plan.explicacionAprendizaje && (
        <Card variant="insight" data-insight-enter="" data-testid="learning_explanation_card">
          <LearningExplanationViewed />
          <CardContent className="text-body-sm">
            {plan.explicacionAprendizaje}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
