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

// FRESCO-1134: three rows of text on the brand band instead of three equal cards with a ✗ square
// (Anti Web Slop counts equal cards and icon-in-a-square). The hairlines use the accent ramp: on
// `primary` the `border` token (text at 16 %) would be invisible.
export function PainPoints() {
  return (
    <section className="border-y border-border bg-primary">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-24">
        <h2 className="text-h2 tracking-tight text-background">
          ¿Cuántas veces has acabado comiendo lo que sea?
        </h2>
        <ul className="mt-12 border-b border-accent-400">
          {PAIN_POINTS.map(point => (
            <li
              key={point.lead}
              className="grid gap-2 border-t border-accent-400 py-6 md:grid-cols-[5fr_7fr] md:items-baseline md:gap-8"
            >
              <span className="text-h3 text-background">{point.lead}</span>
              <span className="max-w-md text-body-md text-accent-100">{point.rest}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
