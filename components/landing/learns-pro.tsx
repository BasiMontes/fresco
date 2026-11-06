import { Card } from '@/components/ui/card';
import { Reveal } from '@/components/ui/reveal';
import { cn } from '@/lib/utils';

// FRESCO-791: every line below is a claim the Pro engine really backs;
// `landing-claims.test.ts` maps each one to its source in code. The weekly
// labels are a guide, not a promise of when the effect starts: the exclusion
// window is the last 2 weeks and only counts recipes the user marked.
export const TIMELINE = [
  {
    week: 'Semana 1',
    title: 'Tu primer menú',
    description: 'Generado desde tu perfil. Personalizado desde el primer día.',
    highlighted: false,
  },
  {
    week: 'Semana 2',
    title: 'Marca lo que cocinas',
    description: 'Marca lo que cocinas y lo que descartas. La semana siguiente esas recetas no vuelven.',
    highlighted: false,
  },
  {
    week: 'Semana 4',
    title: 'Te acierta más',
    description: 'Las recetas que cocinas con frecuencia ganan peso en tu menú y las que descartas, lo pierden.',
    highlighted: false,
  },
  {
    week: 'Semana 8+',
    title: 'Te explica el porqué',
    description: 'Cada menú trae una nota con lo que Fresco ha tenido en cuenta de lo que cocinas.',
    highlighted: true,
  },
] as const;

/**
 * FRESCO-1134: a timeline, because the weeks are a real sequence, instead of four equal cards.
 * One line with four nodes from `md` up, a vertical line below it. Only the nodes settle in
 * (`Reveal`, disabled under prefers-reduced-motion); the page-wide reveal is gone. The Semana 8+
 * node keeps the `insight` card: it is the "Fresco explains what it learned" moment.
 */
export function LearnsPro() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-24">
        <span className="mb-4 inline-block rounded-full bg-accent-100 px-3 py-1 text-h6 uppercase text-primary">
          Solo en Pro
        </span>
        <h2 className="mb-2 text-h2 text-text">Aprende de lo que cocinas.</h2>
        <p className="max-w-lg text-body-md text-tertiary">
          Fresco usa lo que marcas como cocinado o descartado para afinar tus menús.
        </p>
        <ol className="mt-12 border-l border-neutral-500 pl-[26px] md:grid md:grid-cols-4 md:gap-6 md:border-l-0 md:border-t md:pl-0">
          {TIMELINE.map(item => (
            <li key={item.week} className="relative pb-8 last:pb-0 md:pb-0 md:pt-6">
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -left-[32px] top-[6px] size-[11px] rounded-full border-2 border-primary md:-top-[6px] md:left-0',
                  item.highlighted ? 'bg-primary' : 'bg-surface',
                )}
              />
              <Reveal>
                {item.highlighted
                  ? (
                      <Card variant="insight" className="p-4">
                        <TimelineEntry item={item} />
                      </Card>
                    )
                  : <TimelineEntry item={item} />}
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function TimelineEntry({ item }: { item: (typeof TIMELINE)[number] }) {
  return (
    <>
      <p className={cn('mb-1 text-h6 uppercase text-tertiary', item.highlighted && 'text-accent-800')}>{item.week}</p>
      <h3 className="text-h3">{item.title}</h3>
      <p className={cn('mt-1 max-w-xs text-body-md text-tertiary', item.highlighted && 'text-accent-800')}>
        {item.description}
      </p>
    </>
  );
}
