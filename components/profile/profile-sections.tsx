import type { ReactNode } from 'react';

/**
 * FRESCO-972 (UX-19): `/profile` is one long stack, so it is grouped into three
 * sections reachable from an in-page anchor nav. Plain `#id` links: no client
 * state, they work without JS and the sidebar's `/profile#ayuda` deep links keep
 * working because the card ids inside the sections are untouched.
 */
export const PROFILE_SECTIONS = [
  { id: 'preferencias', label: 'Preferencias' },
  { id: 'suscripcion', label: 'Suscripción' },
  { id: 'cuenta', label: 'Cuenta' },
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]['id'];

export function ProfileSectionNav() {
  return (
    <nav
      aria-label="Secciones del perfil"
      data-testid="profile_section_nav"
      className="sticky top-0 z-10 -mx-1 mt-4 flex gap-2 overflow-x-auto bg-background px-1 py-2"
    >
      {PROFILE_SECTIONS.map(section => (
        <a
          key={section.id}
          href={`#${section.id}`}
          data-testid={`profile_section_link_${section.id}`}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border px-4 text-label text-text hover:bg-neutral-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}

interface ProfileSectionProps {
  id: ProfileSectionId
  children: ReactNode
}

/** Anchor target + landmark. The heading is screen-reader only: each card already carries a visible title. */
export function ProfileSection({ id, children }: ProfileSectionProps) {
  const label = PROFILE_SECTIONS.find(section => section.id === id)?.label;
  const headingId = `profile-section-${id}`;
  return (
    <section id={id} aria-labelledby={headingId} data-testid={`profile_section_${id}`} className="scroll-mt-16">
      <h2 id={headingId} className="sr-only">{label}</h2>
      {children}
    </section>
  );
}
