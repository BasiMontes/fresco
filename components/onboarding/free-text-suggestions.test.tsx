import { beforeEach, describe, expect, test } from 'bun:test';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { OnboardingStepDiet } from './onboarding-step-diet';

/**
 * FRESCO-1228 — the free-text boxes of the diet step propose allergens and
 * ingredients to avoid; only a click on "Añadir" writes to the store. The
 * phrase table of the vocabulary itself lives in
 * `lib/onboarding/free-text-suggestions.test.ts`.
 */

const dietaBox = 'dieta_texto_libre_input';
const ingredientsBox = 'ingredientes_odiados_texto_libre_input';

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

function render() {
  return renderWithProviders(<OnboardingStepDiet headingRef={{ current: null }} />);
}

describe('OnboardingStepDiet — suggestions from the free-text boxes (FRESCO-1228)', () => {
  test('the polite live region is in the DOM, empty, before anything is typed', () => {
    render();

    for (const id of ['dieta_texto_libre_sugerencias', 'ingredientes_odiados_texto_libre_sugerencias']) {
      expect(screen.getByTestId(id)).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByTestId(id)).toBeEmptyDOMElement();
    }
    expect(screen.queryAllByTestId('texto_libre_sugerencia')).toHaveLength(0);
  });

  test('typing an allergen suggests it inside the live region and applies NOTHING', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'alergia al maní');

    const region = screen.getByTestId('dieta_texto_libre_sugerencias');
    const item = screen.getByTestId('texto_libre_sugerencia');
    expect(region).toContainElement(item);
    expect(item).toHaveTextContent('Has escrito «maní»: ¿lo añadimos como alérgeno (Cacahuetes)?');
    expect(region).toHaveTextContent('No se aplica ningún filtro hasta que lo añadas tú');
    expect(useOnboardingStore.getState().alergenos).toEqual([]);
    expect(useOnboardingStore.getState().ingredientesOdiados).toEqual([]);
    // the FRESCO-1000 warning is still there, untouched
    expect(screen.getByTestId('dieta_texto_libre_aviso')).toHaveTextContent('Esto no se usa para filtrar recetas');
  });

  test('leaving the box does not apply it either', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'marisco');
    await user.tab();

    expect(useOnboardingStore.getState().alergenos).toEqual([]);
  });

  test('confirming writes the exact allergen key to the store and the chip above turns selected', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'ajonjolí');
    await user.click(screen.getByTestId('texto_libre_sugerencia_aceptar'));

    expect(useOnboardingStore.getState().alergenos).toEqual(['sesamo']);
    expect(screen.queryByTestId('texto_libre_sugerencia')).toBeNull();
    const selected = screen.getAllByTestId('alergeno_option').filter(b => b.getAttribute('aria-pressed') === 'true');
    expect(selected.map(b => b.textContent)).toEqual(['Sésamo']);
  });

  test('marisco is ONE suggestion naming both values; one click writes both, never half', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'marisco');
    const items = screen.getAllByTestId('texto_libre_sugerencia');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Has escrito «marisco»: ¿lo añadimos como alérgeno (Crustáceos y Moluscos)?');
    expect(screen.getByTestId('texto_libre_sugerencia_aceptar')).toHaveTextContent('Añadir Crustáceos y Moluscos');
    expect(useOnboardingStore.getState().alergenos).toEqual([]);

    await user.click(screen.getByTestId('texto_libre_sugerencia_aceptar'));

    expect([...useOnboardingStore.getState().alergenos].sort()).toEqual(['crustaceos', 'moluscos']);
    expect(screen.queryByTestId('texto_libre_sugerencia')).toBeNull();
  });

  test('dismissing the marisco group removes it and writes nothing', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'marisco');
    await user.click(screen.getByTestId('texto_libre_sugerencia_descartar'));

    expect(screen.queryByTestId('texto_libre_sugerencia')).toBeNull();
    expect(useOnboardingStore.getState().alergenos).toEqual([]);
  });

  test('Descartar leaves the store exactly as it was', async () => {
    const user = setupUser();
    render();
    useOnboardingStore.setState({ alergenos: ['soja'] });
    const before = JSON.stringify(useOnboardingStore.getState());

    await user.type(screen.getByTestId(dietaBox), 'mostaza');
    await user.click(screen.getByTestId('texto_libre_sugerencia_descartar'));

    // only the free-text field itself changed
    useOnboardingStore.setState({ dietaTextoLibre: '' });
    expect(JSON.stringify(useOnboardingStore.getState())).toBe(before);
  });

  test('after Añadir, focus moves to the next suggestion; after the last one, to the region (never body)', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'mostaza y apio');
    expect(screen.getAllByTestId('texto_libre_sugerencia')).toHaveLength(2);

    await user.click(screen.getAllByTestId('texto_libre_sugerencia_aceptar')[0]);
    const remaining = screen.getAllByTestId('texto_libre_sugerencia');
    expect(remaining).toHaveLength(1);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('texto_libre_sugerencia_aceptar')));

    await user.click(screen.getByTestId('texto_libre_sugerencia_aceptar'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('dieta_texto_libre_sugerencias')));
    expect(document.activeElement).not.toBe(document.body);
  });

  test('after Descartar the focus also stays inside the suggestions', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'mostaza');
    await user.click(screen.getByTestId('texto_libre_sugerencia_descartar'));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('dieta_texto_libre_sugerencias')));
  });

  test('the polite region announces what was added or dismissed, and drops the message when the text changes', async () => {
    const user = setupUser();
    render();
    const region = screen.getByTestId('dieta_texto_libre_sugerencias');

    await user.type(screen.getByTestId(dietaBox), 'marisco');
    await user.click(screen.getByTestId('texto_libre_sugerencia_aceptar'));
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Añadido a tus alérgenos: Crustáceos y Moluscos.');

    await user.type(screen.getByTestId(dietaBox), ' mostaza');
    expect(region).not.toHaveTextContent('Añadido a tus alérgenos');
    await user.click(screen.getByTestId('texto_libre_sugerencia_descartar'));
    expect(region).toHaveTextContent('Sugerencia descartada: no se ha añadido nada.');
  });

  test('dismissing «almendras» does not surface «avellanas» for the same allergen', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'almendras y avellanas');
    expect(screen.getAllByTestId('texto_libre_sugerencia')).toHaveLength(1);
    expect(screen.getByTestId('texto_libre_sugerencia')).toHaveTextContent('«almendras»');

    await user.click(screen.getByTestId('texto_libre_sugerencia_descartar'));

    expect(screen.queryByTestId('texto_libre_sugerencia')).toBeNull();
    expect(useOnboardingStore.getState().alergenos).toEqual([]);
  });

  test('a genuinely new mention after a dismissal still gets suggested', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'mostaza');
    await user.click(screen.getByTestId('texto_libre_sugerencia_descartar'));
    await user.type(screen.getByTestId(dietaBox), ' y apio');

    expect(screen.getByTestId('texto_libre_sugerencia')).toHaveAttribute('data-values', 'apio');
  });

  test('a value already selected through a diet flag is not offered again', async () => {
    const user = setupUser();
    render();
    await user.click(screen.getAllByTestId('dieta_option')[2]); // Sin gluten: implies and stores gluten
    expect(useOnboardingStore.getState().alergenos).toContain('gluten');

    await user.type(screen.getByTestId(dietaBox), 'trigo');

    expect(screen.queryByTestId('texto_libre_sugerencia')).toBeNull();
  });

  test('if an implied value is somehow missing from the store, Añadir still writes it (no inert button)', async () => {
    const user = setupUser();
    render();
    useOnboardingStore.setState({ dietaSinGluten: true, alergenos: [] });

    await user.type(screen.getByTestId(dietaBox), 'trigo');
    await user.click(screen.getByTestId('texto_libre_sugerencia_aceptar'));

    expect(useOnboardingStore.getState().alergenos).toEqual(['gluten']);
  });

  test('"sin gluten" typed as text reads as a suggestion for the allergen, never as a diet claim', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'sin gluten');

    expect(screen.getByTestId('texto_libre_sugerencia')).toHaveTextContent('Has escrito «sin gluten»: ¿lo añadimos como alérgeno (Gluten)?');
    expect(useOnboardingStore.getState().dietaSinGluten).toBe(false);
  });

  test('a dismissed suggestion stays dismissed while that text stays, and applies nothing', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'mostaza');
    await user.click(screen.getByTestId('texto_libre_sugerencia_descartar'));
    expect(screen.queryByTestId('texto_libre_sugerencia')).toBeNull();

    await user.type(screen.getByTestId(dietaBox), ' y nada más');
    expect(screen.queryByTestId('texto_libre_sugerencia')).toBeNull();
    expect(useOnboardingStore.getState().alergenos).toEqual([]);
  });

  test('the ingredients box suggests a disliked ingredient and confirming writes it to ingredientesOdiados', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(ingredientsBox), 'cebollas');
    const item = screen.getByTestId('texto_libre_sugerencia');
    expect(item).toHaveAttribute('data-kind', 'ingrediente');
    expect(item).toHaveTextContent('¿lo añadimos como ingrediente a evitar (Cebolla)?');

    await user.click(screen.getByTestId('texto_libre_sugerencia_aceptar'));

    expect(useOnboardingStore.getState().ingredientesOdiados).toEqual(['cebolla']);
    expect(useOnboardingStore.getState().alergenos).toEqual([]);
  });

  test('unrecognised text shows no suggestion, filters nothing and keeps the warning', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(ingredientsBox), 'berenjena');
    await user.type(screen.getByTestId(dietaBox), 'no soy alérgico a nada');

    expect(screen.queryAllByTestId('texto_libre_sugerencia')).toHaveLength(0);
    expect(screen.getByTestId('ingredientes_odiados_texto_libre_aviso')).toHaveTextContent('Esto no se usa para filtrar recetas');
    expect(screen.getByTestId('dieta_texto_libre_aviso')).toHaveTextContent('Esto no se usa para filtrar recetas');
    expect(useOnboardingStore.getState().ingredientesOdiados).toEqual([]);
    expect(useOnboardingStore.getState().alergenos).toEqual([]);
  });

  test('recognised but unconfirmed text still shows the warning', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'cacahuete');

    expect(screen.getByTestId('texto_libre_sugerencia')).toBeTruthy();
    expect(screen.getByTestId('dieta_texto_libre_aviso')).toHaveTextContent('Esto no se usa para filtrar recetas');
  });

  test('two words naming the same allergen give one chip', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'almendras y avellanas');

    expect(screen.getAllByTestId('texto_libre_sugerencia')).toHaveLength(1);
  });

  test('the cuisines box never offers suggestions', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId('cocinas_texto_libre_input'), 'mantequilla de cacahuete, marisco');

    expect(screen.queryAllByTestId('texto_libre_sugerencia')).toHaveLength(0);
  });

  // happy-dom does not compute Tailwind, so this pins the class the component sets for the
  // 44px (min-h-11) contract, not a measured size; the size itself was checked in the browser.
  test('the suggestion buttons set the min-h-11 class and carry text, not colour alone', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId(dietaBox), 'soja');

    for (const id of ['texto_libre_sugerencia_aceptar', 'texto_libre_sugerencia_descartar']) {
      const button = screen.getByTestId(id);
      expect(button).toHaveClass('min-h-11');
      expect(button.textContent?.length).toBeGreaterThan(0);
    }
  });
});
