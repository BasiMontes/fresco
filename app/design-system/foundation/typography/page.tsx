import { FONT_STACKS, TYPE_STEPS } from '@/components/design-system/generated';
import { testIdPart } from '@/components/design-system/test-id';

// Literal class names: Tailwind only emits the utilities it finds written out in the source.
const STEP_CLASS: Record<(typeof TYPE_STEPS)[number]['step'], string> = {
  'h1': 'text-h1 font-heading',
  'h2': 'text-h2 font-heading',
  'display-light': 'text-display-light font-heading',
  'h3': 'text-h3',
  'h4': 'text-h4',
  'h5': 'text-h5',
  'h6': 'text-h6',
  'body-md': 'text-body-md',
  'body-sm': 'text-body-sm',
  'label': 'text-label',
  'caption': 'text-caption',
};

export default function TypographyPage() {
  return (
    <div data-testid="design_system_typography">
      <h1 className="text-h2">Tipografía</h1>
      <p className="mt-2 text-body-md text-tertiary">{`Títulos: ${FONT_STACKS.heading}. Texto: ${FONT_STACKS.sans}.`}</p>
      <ul className="mt-6 flex flex-col gap-4">
        {TYPE_STEPS.map(({ step, size, lineHeight, letterSpacing, fontWeight }) => (
          <li key={step} data-testid={`design_system_type_${testIdPart(step)}`} className="rounded-card border border-border bg-surface-raised p-4">
            <p className={STEP_CLASS[step]}>Menús que aprenden de lo que cocinas</p>
            <p className="mt-2 text-caption text-tertiary">
              {`${step}: ${size}, interlínea ${lineHeight ?? '-'}, espaciado ${letterSpacing ?? '-'}, peso ${fontWeight ?? '-'}`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
