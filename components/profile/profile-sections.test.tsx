import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { PROFILE_SECTIONS, ProfileSection, ProfileSectionNav } from './profile-sections';

/** FRESCO-972 (UX-19): every nav link must land on a section that exists. */
describe('profile sections', () => {
  test('the nav offers Preferencias, Suscripción and Cuenta as in-page anchors', () => {
    renderWithProviders(<ProfileSectionNav />);

    const links = screen.getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual(['Preferencias', 'Suscripción', 'Cuenta']);
    expect(links.map(link => link.getAttribute('href'))).toEqual(['#preferencias', '#suscripcion', '#cuenta']);
  });

  test('each section is a labelled landmark whose id matches its nav link', () => {
    renderWithProviders(
      <>
        {PROFILE_SECTIONS.map(({ id }) => (
          <ProfileSection key={id} id={id}><p>{id}</p></ProfileSection>
        ))}
      </>,
    );

    for (const { id, label } of PROFILE_SECTIONS) {
      expect(screen.getByRole('region', { name: label })).toHaveAttribute('id', id);
    }
  });
});
