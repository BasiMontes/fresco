import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// FRESCO-791 (A6-P3): every line below is a claim the Pro engine really backs;
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

export function LearnsPro() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <span className="mb-4 inline-block rounded-full bg-accent-100 px-3 py-1 text-h6 uppercase text-primary">
          Solo en Pro
        </span>
        <h2 className="mb-2 text-h2 text-text">Aprende de lo que cocinas.</h2>
        <p className="mb-9 max-w-lg text-body-md text-tertiary">
          Fresco usa lo que marcas como cocinado o descartado para afinar tus menús.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {TIMELINE.map(item => (
            <Card
              key={item.week}
              className={cn(item.highlighted ? 'border-2 border-primary bg-accent-100' : 'bg-background')}
            >
              <CardHeader>
                <span
                  className={cn(
                    'inline-block self-start rounded-sm bg-neutral-200 px-2 py-1 text-caption font-bold text-tertiary',
                    item.highlighted && 'bg-accent-200 text-primary',
                  )}
                >
                  {item.week}
                </span>
                <CardTitle className={cn(item.highlighted && 'text-primary')}>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className={cn(item.highlighted && 'text-accent-700')}>
                  {item.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
