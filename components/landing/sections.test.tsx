import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { HowItWorks, STEPS } from './how-it-works';
import { LearnsPro, TIMELINE } from './learns-pro';
import { PainPoints } from './pain-points';
import { Pricing } from './pricing';

/**
 * FRESCO-1134 — the shape of the restructured sections (ratified mockup,
 * `.context/designs/fresco/landing-restructure/`). Anti Web Slop counts equal-card
 * grids, icon-in-a-square, numbered step circles and tick lists, so each section
 * keeps the structure that avoids them while its copy stays the ratified copy.
 */

describe('HowItWorks — vertical walkthrough', () => {
  test('lists the three steps as rows, then the learning moment as its own card', () => {
    const { container } = renderWithProviders(<HowItWorks />);

    const items = container.querySelectorAll('ol > li');
    expect(items).toHaveLength(STEPS.length);
    expect([...items].map(li => li.querySelector('h3')?.textContent)).toEqual(STEPS.map(s => s.title));
    expect(screen.getByText('Cada semana usa lo que marcas')).toBeTruthy();
  });

  test('has no numbered circles and one real menu capture with an alt text and an honest caption', () => {
    const { container } = renderWithProviders(<HowItWorks />);

    expect(container.querySelectorAll('.rounded-full')).toHaveLength(0);
    const photo = container.querySelector('figure img');
    expect(photo?.getAttribute('src')).toContain('menu-example');
    expect(photo?.getAttribute('alt')).toMatch(/Captura de la pantalla de menú de Fresco/);
    expect(container.querySelector('figure figcaption')?.textContent).toMatch(/Menú de ejemplo/);
  });

  test('step 2 carries the no-repeats claim that moved from the removed impact-stats section', () => {
    renderWithProviders(<HowItWorks />);

    expect(screen.getByText(/sin comidas ni cenas repetidas en la misma semana/)).toBeTruthy();
  });
});

describe('PainPoints — three text rows, no cards', () => {
  test('renders the three moments as list rows without the ✗ square', () => {
    const { container } = renderWithProviders(<PainPoints />);

    expect(container.querySelectorAll('ul > li')).toHaveLength(3);
    expect(container.textContent).not.toContain('✗');
    expect(screen.getByText('El miércoles a las 8pm.')).toBeTruthy();
  });
});

describe('LearnsPro — timeline', () => {
  test('lists the weeks in order, because the weeks are a real sequence', () => {
    const { container } = renderWithProviders(<LearnsPro />);

    const weeks = [...container.querySelectorAll('ol > li')].map(li => li.querySelector('p')?.textContent);
    expect(weeks).toEqual(TIMELINE.map(item => item.week));
  });

  test('keeps the Semana 8+ node as the one highlighted insight card', () => {
    const { container } = renderWithProviders(<LearnsPro />);

    const highlighted = container.querySelectorAll('.bg-accent-100.text-accent-800');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].textContent).toContain('Te explica el porqué');
  });
});

// FRESCO-1138: Anti Web Slop flags "Las mismas esquinas redondeadas": the same radius on every box flattens
// the hierarchy. Each role gets its own, only from the existing radius tokens: media `sm`, callouts `md`,
// plan cards `card`; buttons and tags stay pills.
describe('Corner radius says what a box is (FRESCO-1138)', () => {
  test('the walkthrough photo is crisp (sm) and its callout is md, not the card radius', () => {
    const { container } = renderWithProviders(<HowItWorks />);

    const photoFrame = container.querySelector('figure img');
    expect(photoFrame?.className).toContain('rounded-sm');
    expect(photoFrame?.className).not.toContain('rounded-image');
    const callout = screen.getByText('Cada semana usa lo que marcas').closest('div');
    expect(callout?.className).toContain('rounded-md');
    expect(callout?.className).not.toContain('rounded-card');
  });

  test('the highlighted Pro timeline node is a md callout', () => {
    const { container } = renderWithProviders(<LearnsPro />);

    const highlighted = container.querySelector('.bg-accent-100.text-accent-800');
    expect(highlighted?.className).toContain('rounded-md');
    expect(highlighted?.className).not.toContain('rounded-card');
  });

  test('the plan cards keep the card radius', () => {
    const { container } = renderWithProviders(<Pricing prices={null} />);

    expect(container.querySelectorAll('.rounded-card')).toHaveLength(2);
  });
});

describe('Pricing — no tick list, no trailing arrow', () => {
  test('prints the features as rows without ✓ and the CTAs without an arrow', () => {
    const { container } = renderWithProviders(<Pricing prices={null} />);

    expect(container.textContent).not.toContain('✓');
    expect(container.textContent).not.toContain('→');
    expect(container.querySelectorAll('ul > li').length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText('Empezar 7 días gratis')).toBeTruthy();
  });
});
