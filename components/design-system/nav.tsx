import { NavLink } from './nav-link';
import { REGISTRY, registrySlugs } from './registry';

const FOUNDATION_LINKS = [
  { label: 'Colores', href: '/design-system/foundation/colors' },
  { label: 'Tipografía', href: '/design-system/foundation/typography' },
  { label: 'Iconos', href: '/design-system/foundation/icons' },
];

function NavSection({ title, links }: { title: string, links: { label: string, href: string }[] }) {
  return (
    <div>
      <h2 className="text-label">{title}</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {links.map(({ label, href }) => (
          <li key={href}><NavLink href={href} label={label} className="text-body-sm text-primary underline" /></li>
        ))}
      </ul>
    </div>
  );
}

export function DesignSystemNav() {
  const components = registrySlugs().map(slug => ({ label: REGISTRY[slug].title, href: `/design-system/components/${slug}` }));
  return (
    <nav aria-label="Sistema de diseño" data-testid="design_system_nav" className="flex flex-col gap-4 md:w-48 md:shrink-0">
      <NavSection title="Fundamentos" links={FOUNDATION_LINKS} />
      <NavSection title="Componentes" links={components} />
    </nav>
  );
}
