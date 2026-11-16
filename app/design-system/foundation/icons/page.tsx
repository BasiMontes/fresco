import { ICON_GALLERY } from '@/components/design-system/icon-gallery.generated';
import { MenuMark, PlusMark, ThemeMark } from '@/components/ui/css-glyphs';

const GLYPHS = [
  { name: 'PlusMark', glyph: <PlusMark /> },
  { name: 'MenuMark', glyph: <MenuMark open={false} /> },
  { name: 'ThemeMark', glyph: <ThemeMark kind="light" /> },
];

const tile = 'flex flex-col items-center gap-2 rounded-card border border-border bg-surface-raised p-3 text-text';

export default function IconsPage() {
  return (
    <div data-testid="design_system_icons">
      <h1 className="text-h2">Iconos</h1>
      <p className="mt-2 text-body-md text-tertiary">Los iconos de Lucide que usa la app y las marcas dibujadas con CSS.</p>
      <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {Object.entries(ICON_GALLERY).map(([name, Icon]) => (
          <li key={name} data-testid={`design_system_icon_${name}`} className={tile}>
            <Icon aria-hidden="true" />
            <span className="text-caption text-tertiary">{name}</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-h3">Marcas CSS</h2>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {GLYPHS.map(({ name, glyph }) => (
          <li key={name} data-testid={`design_system_icon_${name}`} className={tile}>
            {glyph}
            <span className="text-caption text-tertiary">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
