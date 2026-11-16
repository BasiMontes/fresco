import { testIdPart } from './test-id';

/**
 * FRESCO-1207: one colour token of the design system. The chip paints `var(--color-<name>)`, so it follows
 * the active theme; the label gives the light and dark values the generator read from `globals.css`.
 */
export function ColorSwatch({ name, light, dark }: { name: string, light: string, dark: string }) {
  return (
    <li data-testid={`design_system_color_${testIdPart(name)}`} className="flex flex-col gap-2 rounded-card border border-border bg-surface-raised p-3">
      <div className="h-16 rounded-md border border-border" style={{ backgroundColor: `var(--color-${name})` }} />
      <p className="text-label text-text">{name}</p>
      <p className="text-caption text-tertiary">{`Claro: ${light}`}</p>
      <p className="text-caption text-tertiary">{`Oscuro: ${dark}`}</p>
    </li>
  );
}
