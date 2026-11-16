import { GLYPH_NAMES } from '@/components/design-system/generated';
import { ICON_GALLERY } from '@/components/design-system/icon-gallery.generated';
import { testIdPart } from '@/components/design-system/test-id';
import { MenuMark, PlusMark, ThemeMark } from '@/components/ui/css-glyphs';

// Typed against the generated list: adding or removing a glyph in css-glyphs.tsx fails `tsc` here until updated.
const GLYPH_NODES: Record<(typeof GLYPH_NAMES)[number], React.ReactNode> = {
  PlusMark: <PlusMark />,
  MenuMark: <MenuMark open={false} />,
  ThemeMark: <ThemeMark kind="light" />,
};

const tile = 'flex flex-col items-center gap-2 rounded-card border border-border bg-surface-raised p-3 text-text';

export default function IconsPage() {
  return (
    <div data-testid="design_system_icons">
      <h1 className="text-h2">Iconos</h1>
      <p className="mt-2 text-body-md text-tertiary">Los iconos de Lucide que usa la app y las marcas dibujadas con CSS.</p>
      <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {Object.entries(ICON_GALLERY).map(([name, Icon]) => (
          <li key={name} data-testid={`design_system_icon_${testIdPart(name)}`} className={tile}>
            <Icon aria-hidden="true" />
            <span className="text-caption text-tertiary">{name}</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-h3">Marcas CSS</h2>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {GLYPH_NAMES.map(name => (
          <li key={name} data-testid={`design_system_icon_${testIdPart(name)}`} className={tile}>
            {GLYPH_NODES[name]}
            <span className="text-caption text-tertiary">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
