import Link from 'next/link';
import { REGISTRY, registrySlugs } from '@/components/design-system/registry';

const FOUNDATION_LINKS = [
  { label: 'Colores', href: '/design-system/foundation/colors' },
  { label: 'Tipografía', href: '/design-system/foundation/typography' },
  { label: 'Iconos', href: '/design-system/foundation/icons' },
];

/** FRESCO-1207 / FRESCO-1216: landing of the docs, with the Foundation pages and every documented component. */
export default function DesignSystemPage() {
  const components = registrySlugs().map(slug => ({ label: REGISTRY[slug].title, href: `/design-system/components/${slug}` }));
  return (
    <div data-testid="design_system_home">
      <h1 className="text-h2">Sistema de diseño</h1>
      <p className="mt-2 text-body-md text-tertiary">Los fundamentos y los componentes de Fresco, con ejemplos vivos y su código.</p>
      <h2 className="mt-8 text-h4">Fundamentos</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {FOUNDATION_LINKS.map(({ label, href }) => (
          <li key={href}><Link href={href} className="text-body-md text-primary underline">{label}</Link></li>
        ))}
      </ul>
      <h2 className="mt-8 text-h4">Componentes</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {components.map(({ label, href }) => (
          <li key={href}><Link href={href} className="text-body-md text-primary underline">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
