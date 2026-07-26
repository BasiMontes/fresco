import { Zap } from 'lucide-react';
import Link from 'next/link';

import { RecipeCard } from '@/components/recipe/recipe-card';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildMockWeeklyMenu } from '@/lib/mock/recipes';

/**
 * `/menu` (Home) — nav item 1. Today's meals at a glance + the
 * `card-insight` component, DESIGN.md's answer to the Constitution's named
 * risk that "Free-tier users won't perceive the Pro-tier learning moat
 * unless it's made visible" (EPIC-FRESCO-5, US 5.3). Mock data only — real
 * generation wiring belongs to /sprint-development story work.
 */
export default function MenuPage() {
  const menu = buildMockWeeklyMenu();
  const hoy = menu.lunes;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h2">Hoy</h1>
      <p className="mt-1 text-body-md text-tertiary">Tu menú de lunes, listo.</p>

      <Card variant="insight" className="mt-6">
        <CardHeader>
          <p className="text-h6 uppercase">Fresco aprendió</p>
          <CardTitle>Menos pimentón picante esta semana</CardTitle>
        </CardHeader>
        <CardContent className="text-body-sm">
          Descartaste el curry picante la semana pasada, así que hemos suavizado las especias en
          tus platos con curry.
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(['desayuno', 'comida', 'cena'] as const).map(slot => (
          <div key={slot}>
            <p className="mb-2 text-h6 uppercase text-tertiary">{slot}</p>
            <RecipeCard recipe={hoy[slot]} />
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <Link href="/calendar" className={buttonVariants({ variant: 'action', size: 'lg' })}>
          <Zap className="size-[18px]" strokeWidth={2} />
          Cocinar ya
        </Link>
      </div>
    </div>
  );
}
