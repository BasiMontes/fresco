import { beforeEach, describe, expect, test } from 'bun:test';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { OnboardingSummary } from './onboarding-summary';

/**
 * FRESCO-755 — the read-only recap after the 3 data steps. Pins that answers
 * are shown per block, that allergens are always visible (explicit "none"
 * when empty), and that each block's edit icon routes back to its step.
 */

const headingRef = { current: null };

function render() {
  return renderWithProviders(<OnboardingSummary headingRef={headingRef} />);
}

describe('OnboardingSummary', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  test('shows the answers of each block', () => {
    useOnboardingStore.setState({
      nombre: 'Laura',
      sexo: 'mujer',
      objetivo: 'comer_sano',
      dietaVegetariano: true,
      dietaTextoLibre: 'sin picante',
      cocinasFavoritas: ['italiana'],
      adultos: 2,
      ninos: 1,
      presupuestoSemanaEuros: 80,
    });
    render();

    expect(screen.getByText('Laura')).toBeInTheDocument();
    expect(screen.getByText('Mujer')).toBeInTheDocument();
    expect(screen.getByText('Comer sano')).toBeInTheDocument();
    expect(screen.getByText('Vegetariano')).toBeInTheDocument();
    expect(screen.getByText('sin picante')).toBeInTheDocument();
    expect(screen.getByText('Italiana')).toBeInTheDocument();
    expect(screen.getByText('2 adultos · 1 niño')).toBeInTheDocument();
    expect(screen.getByText('80 €')).toBeInTheDocument();
  });

  test('allergens are visible without expanding anything', () => {
    useOnboardingStore.setState({ alergenos: ['gluten'] });
    render();

    expect(screen.getByTestId('summary_allergens')).toHaveTextContent('Gluten');
  });

  test('says explicitly when no allergen was declared', () => {
    render();

    expect(screen.getByTestId('summary_allergens')).toHaveTextContent('Ninguno indicado');
  });

  test('summarizes the default planning as the whole week with the 3 meals', () => {
    render();

    expect(screen.getByText('Toda la semana')).toBeInTheDocument();
    expect(screen.getByText('Desayuno, Almuerzo, Cena')).toBeInTheDocument();
  });

  test.each([
    ['profile', 1],
    ['diet', 2],
    ['household', 3],
  ] as const)('the %s edit icon opens step %i and marks the return to the summary', async (section, step) => {
    const user = setupUser();
    useOnboardingStore.setState({ step: 4 });
    render();

    await user.click(screen.getByTestId(`summary_edit_${section}`));

    expect(useOnboardingStore.getState().step).toBe(step);
    expect(useOnboardingStore.getState().returnToSummary).toBe(true);
  });
});
