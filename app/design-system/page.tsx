import Link from 'next/link';

const FOUNDATION_LINKS = [
  { label: 'Colores', href: '/design-system/foundation/colors' },
  { label: 'Tipografía', href: '/design-system/foundation/typography' },
  { label: 'Iconos', href: '/design-system/foundation/icons' },
];

/**
 * FRESCO-1207 (PR 2 of 4): landing with the Foundation pages. Component pages and the nav arrive later.
 */
export default function DesignSystemPage() {
  return (
    <div data-testid="design_system_home">
      <h1 className="text-h2">Sistema de diseño</h1>
      <p className="mt-2 text-body-md text-tertiary">Los fundamentos de Fresco. Los componentes llegarán en las próximas entregas.</p>
      <ul className="mt-6 flex flex-col gap-2">
        {FOUNDATION_LINKS.map(({ label, href }) => (
          <li key={href}><Link href={href} className="text-body-md text-primary underline">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
