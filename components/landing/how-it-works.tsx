import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    number: '1',
    title: 'Cuéntanos cómo coméis',
    description: 'Alergias, lo que no os gusta, cuántos sois, cuánto tiempo tenéis. Una sola vez.',
    highlighted: false,
  },
  {
    number: '2',
    title: 'Tu menú listo en 30 segundos',
    description: '21 platos de lunes a domingo, ajustados a vosotros. Cambia lo que no te convenza con un toque.',
    highlighted: false,
  },
  {
    number: '3',
    title: 'Lista de la compra ya hecha',
    description: 'Ingredientes agrupados por pasillos. Marca lo que ya tienes. Ve al súper con la cabeza despejada.',
    highlighted: false,
  },
  {
    number: '+',
    title: 'Cada semana mejora solo',
    description: 'Fresco aprende de lo que cocinas y lo que rechazas. Sin que tengas que decir nada.',
    highlighted: true,
  },
] as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-5xl px-4 py-16 md:px-8">
      <p className="mb-2 text-h6 uppercase text-tertiary">Cómo funciona</p>
      <h2 className="mb-2 text-h2 text-text">Tres pasos. Un domingo sin agobios.</h2>
      <p className="mb-9 max-w-lg text-body-md text-tertiary">
        Menos de 2 minutos la primera vez. 30 segundos cada semana siguiente.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {STEPS.map(step => (
          <Card key={step.title}>
            <CardHeader>
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-full text-label',
                  step.highlighted ? 'bg-secondary text-text' : 'bg-primary text-background',
                )}
              >
                {step.number}
              </span>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{step.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
