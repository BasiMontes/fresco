import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import * as posthogEvents from '@/lib/posthog/events';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { Hero } from './hero';

describe('Hero', () => {
  afterEach(() => {
    spyOn(posthogEvents, 'captureEvent').mockRestore();
  });

  test('presents the product promise as the page heading', () => {
    renderWithProviders(<Hero />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Deja de improvisar en el súper.');
    expect(screen.getByText(/Fresco es el planificador de menús semanales/)).toBeInTheDocument();
    expect(screen.getByText('Tu menú semanal, listo en 30 segundos')).toBeInTheDocument();
  });

  test('primary CTA leads to onboarding and reports the hero location', async () => {
    const capture = spyOn(posthogEvents, 'captureEvent').mockImplementation(() => {});
    const user = setupUser();
    renderWithProviders(<Hero />);

    const cta = screen.getByRole('link', { name: /Generar mi primer menú/ });
    expect(cta).toHaveAttribute('href', '/onboarding');

    await user.click(cta);

    expect(capture).toHaveBeenCalledWith('landing_cta_clicked', { location: 'hero' });
  });

  test('secondary link jumps to the how-it-works section', () => {
    renderWithProviders(<Hero />);

    expect(screen.getByRole('link', { name: '¿Cómo funciona?' })).toHaveAttribute('href', '#como-funciona');
  });

  test('lists the two benefits', () => {
    renderWithProviders(<Hero />);

    expect(screen.getByText('Menos tiempo decidiendo')).toBeInTheDocument();
    expect(screen.getByText('Menos comida tirada')).toBeInTheDocument();
  });

  // FRESCO-1141: the hero shows the catalogue's own clay icons, served from `public/landing/hero/`.
  const heroImageSources = (container: HTMLElement) =>
    [...container.querySelectorAll('img')].map(image => decodeURIComponent(image.getAttribute('src') ?? ''));

  test('shows eight clay illustrations, each rendered twice so the two columns loop', () => {
    const { container } = renderWithProviders(<Hero />);

    const sources = heroImageSources(container);

    expect(sources).toHaveLength(16);
    expect(new Set(sources).size).toBe(8);
    for (const source of sources) {
      expect(source).toContain('/landing/hero/');
    }
  });

  test('uses no stock photo', () => {
    const { container } = renderWithProviders(<Hero />);

    for (const source of heroImageSources(container)) {
      expect(source).not.toContain('unsplash');
    }
  });

  test('keeps the illustrations decorative and says in a visible caption that they are AI-generated', () => {
    const { container } = renderWithProviders(<Hero />);

    for (const image of container.querySelectorAll('img')) {
      expect(image).toHaveAttribute('alt', '');
    }
    expect(screen.queryAllByRole('img')).toHaveLength(0);

    // Not `aria-hidden`: the caption is what tells the reader the images are illustrations.
    const caption = screen.getByText('Ilustraciones de platos del catálogo, generadas con IA.');

    expect(caption).toBeInTheDocument();
    expect(caption.closest('[aria-hidden="true"]')).toBeNull();
  });
});
