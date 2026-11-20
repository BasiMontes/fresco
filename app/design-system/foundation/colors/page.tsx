import { ColorSwatch } from '@/components/design-system/color-swatch';
import { COLOR_TOKENS } from '@/components/design-system/generated';

export default function ColorsPage() {
  return (
    <div data-testid="design_system_colors">
      <h1 className="text-h2">Colores</h1>
      <p className="mt-2 text-body-md text-tertiary">Cada muestra sigue el tema activo; debajo van los valores de cada tema.</p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {COLOR_TOKENS.map(color => <ColorSwatch key={color.name} {...color} />)}
      </ul>
    </div>
  );
}
