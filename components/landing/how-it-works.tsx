import Image from 'next/image';

import { Card } from '@/components/ui/card';
import { HERO_PHOTOS } from './hero';

// FRESCO-1134: the walkthrough is a vertical list of steps beside one catalogue photo instead of a
// grid of four equal cards (Anti Web Slop counts equal-card grids and numbered step circles). The
// copy is the ratified copy, except step 2, which absorbs the one claim of the removed `ImpactStats`
// section that no other section repeated: no repeated lunches or dinners within the same week.
// `landing-claims.test.ts` maps both claims below to the code that backs them.
export const STEPS = [
  {
    title: 'Cuéntanos cómo coméis',
    description: 'Alergias, lo que no os gusta, cuántos sois, cuánto tiempo tenéis. Una sola vez.',
  },
  {
    title: 'Tu menú listo en 30 segundos',
    description: '21 platos de lunes a domingo, ajustados a vosotros y sin comidas ni cenas repetidas en la misma semana. Cambia lo que no te convenza con un toque.',
  },
  {
    title: 'Lista de la compra ya hecha',
    description: 'Ingredientes agrupados por pasillos. Marca lo que ya tienes. Ve al súper con la cabeza despejada.',
  },
] as const;

// FRESCO-934: the learning loop reads the dishes the person marks as cooked or discarded (ADR-0006)
// and only applies in Pro, so it does not learn "on its own".
// FRESCO-1135: the title says what the engine does, not how much better it gets. No data shows that
// learning from marks improves menus yet (`.context/reports/2026-11-06-learning-vs-discards-sample.md`).
const LEARNS = {
  title: 'Cada semana usa lo que marcas',
  description: 'Marca lo que cocinas y lo que descartas, con un toque. En Pro, Fresco lo usa para afinar tus menús cada semana.',
} as const;

// The "Sopa de tomate y albahaca" photo of the hero set: already live in the catalogue and checked
// against its dish name (FRESCO-459). A real `/menu` capture could replace it later.
const WALKTHROUGH_PHOTO = HERO_PHOTOS[3];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-24">
      <h2 className="mb-2 text-h2 text-text">Un domingo sin agobios.</h2>
      <p className="max-w-lg text-body-md text-tertiary">
        Menos de 2 minutos la primera vez. 30 segundos cada semana siguiente.
      </p>
      <div className="mt-12 grid gap-12 min-[900px]:grid-cols-[7fr_5fr] min-[900px]:items-start min-[900px]:gap-16">
        <div>
          <ol className="border-b border-border">
            {STEPS.map(step => (
              <li key={step.title} className="border-t border-border py-6">
                <h3 className="text-h3 text-text">{step.title}</h3>
                <p className="mt-2 max-w-md text-body-md text-tertiary">{step.description}</p>
              </li>
            ))}
          </ol>
          <Card variant="insight" className="mt-6 rounded-md p-6">
            <h3 className="text-h3">{LEARNS.title}</h3>
            <p className="mt-2 max-w-md text-body-md">{LEARNS.description}</p>
          </Card>
        </div>
        <figure className="min-[900px]:sticky min-[900px]:top-24">
          <div className="relative aspect-4/3 overflow-hidden rounded-sm min-[900px]:aspect-4/5">
            <Image
              src={WALKTHROUGH_PHOTO.src}
              alt={`${WALKTHROUGH_PHOTO.alt}, una de las recetas del catálogo de Fresco`}
              fill
              sizes="(max-width: 900px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
          <figcaption className="mt-2 text-body-sm text-tertiary">
            {WALKTHROUGH_PHOTO.alt}
            , del catálogo de Fresco.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
