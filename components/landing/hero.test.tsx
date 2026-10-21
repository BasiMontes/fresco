import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import * as posthogEvents from '@/lib/posthog/events';
import { renderWithProviders, screen, setupUser, within } from '@/tests/component-render';
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

  test('shows the dish photos with alt text, looped in two columns', () => {
    const { container } = renderWithProviders(<Hero />);

    // Each of the 8 photos is rendered twice so the marquee loops seamlessly.
    expect(screen.getAllByRole('img', { name: 'Huevos rancheros' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Solomillo de cerdo' })).toHaveLength(2);
    expect(container.querySelectorAll('img')).toHaveLength(16);
    expect(within(container).getAllByRole('img', { name: 'Gambas al ajillo' })[0]).toHaveAttribute('src');
  });
});
