const PAIN_POINTS = [
  {
    lead: 'El domingo por la tarde.',
    rest: 'Mirando el techo intentando recordar qué había en la nevera.',
  },
  {
    lead: 'El súper sin lista.',
    rest: 'Sales con el doble de lo que necesitas y olvidas la mitad de lo que ibas a buscar.',
  },
  {
    lead: 'El miércoles a las 8pm.',
    rest: 'Nevera medio vacía, cansancio máximo y la pregunta de siempre: ¿qué hacemos de cenar?',
  },
] as const;

export function PainPoints() {
  return (
    <section className="border-y border-border bg-primary">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <p className="mb-4 text-h6 uppercase text-accent-200">El problema real</p>
        <h2 className="mb-8 text-h2 tracking-tight text-background">
          ¿Cuántas veces has acabado comiendo lo que sea?
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PAIN_POINTS.map(point => (
            <div key={point.lead} className="flex flex-col gap-3 rounded-md border border-accent-500 bg-accent-600 p-5">
              <span className="grid size-8 place-items-center rounded-sm bg-error text-body-sm font-bold text-background">
                ✗
              </span>
              <p className="text-body-sm text-accent-100">
                <strong className="font-bold text-background">{point.lead}</strong>
                {' '}
                {point.rest}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
