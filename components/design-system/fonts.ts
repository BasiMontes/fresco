/**
 * FRESCO-1234: the real typefaces of the system and the role each one plays, as DESIGN.md's Typography section states them.
 * Names only, never the CSS stack: the stack is an implementation detail, not design information.
 * `fonts.test.ts` keeps this in step with DESIGN.md.
 */
export const FONT_FAMILIES = [
  {
    key: 'heading',
    name: 'Young Serif',
    weight: '400',
    role: 'Títulos h1 y h2, en peso 400.',
    sampleClass: 'font-heading text-h2',
  },
  {
    key: 'sans',
    name: 'Figtree',
    weight: '400 y 600',
    role: 'Todo lo demás: títulos h3 a h6, cuerpo, etiquetas y botones.',
    sampleClass: 'font-sans text-body-md',
  },
] as const;
