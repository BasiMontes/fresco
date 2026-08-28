import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TIMELINE = [
  {
    week: 'Semana 1',
    title: 'Tu primer menú',
    description: 'Generado desde tu perfil. Personalizado desde el primer día.',
    highlighted: false,
  },
  {
    week: 'Semana 2',
    title: 'Ya no repetimos',
    description: 'Sin recetas de la semana pasada. Sin que tengas que decir nada.',
    highlighted: false,
  },
  {
    week: 'Semana 4',
    title: 'Empieza a conocerte',
    description: '"Vimos que siempre descartas el pescado los miércoles. Esta semana, nada de pescado."',
    highlighted: false,
  },
  {
    week: 'Semana 8+',
    title: 'Rara vez descartas algo',
    description: 'El menú ya suena a vosotros. No a una app.',
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
        <h2 className="mb-2 text-h2 text-text">No te pregunta. Aprende.</h2>
        <p className="mb-9 max-w-lg text-body-md text-tertiary">
          A diferencia de ChatGPT, Fresco recuerda lo que cocinas de verdad — no lo que dices que te gusta.
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
