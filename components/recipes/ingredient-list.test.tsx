import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';

void mock.module('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const getSafeSubstitutesMock = mock(async () => [{ ingredienteSustituto: 'leche de avena', alergenos: [] }]);
const confirmSubstitutionMock = mock(async () => {});

class FakeIngredientSubstitutionError extends Error {}

void mock.module('@/lib/ingredients/get-safe-substitutes', () => ({
  getSafeSubstitutes: getSafeSubstitutesMock,
  IngredientSubstitutionError: FakeIngredientSubstitutionError,
}));
void mock.module('@/lib/ingredients/confirm-substitution', () => ({
  confirmSubstitution: confirmSubstitutionMock,
}));

const { IngredientList } = await import('./ingredient-list');

/**
 * FRESCO-534 — pins the "sustituir" trigger, candidate fetch, and the
 * optimistic-apply/revert cycle. Network calls are mocked at the
 * `lib/ingredients/*` boundary (small, single-purpose modules — not the
 * `lib/api/*` re-transpile cliff `delete-week-button.test.tsx` documents).
 */
describe('IngredientList', () => {
  test('no slotId — renders ingredients with no "Sustituir" trigger', () => {
    renderWithProviders(<IngredientList ingredientes={['leche', 'tomate']} />);

    expect(screen.getByText('leche')).toBeInTheDocument();
    expect(screen.queryByTestId('ingredient_substitute_trigger_leche')).toBeNull();
  });

  test('opens the dialog and shows the fetched candidate', async () => {
    const user = setupUser();
    renderWithProviders(<IngredientList ingredientes={['leche', 'tomate']} slotId="slot-1" />);

    await user.click(screen.getByTestId('ingredient_substitute_trigger_leche'));

    expect(await screen.findByTestId('ingredient_substitute_option_leche de avena')).toBeInTheDocument();
    expect(getSafeSubstitutesMock).toHaveBeenCalledWith({}, 'leche');
  });

  test('confirming a candidate optimistically replaces the ingredient in the list', async () => {
    const user = setupUser();
    renderWithProviders(<IngredientList ingredientes={['leche', 'tomate']} slotId="slot-1" />);

    await user.click(screen.getByTestId('ingredient_substitute_trigger_leche'));
    await user.click(await screen.findByTestId('ingredient_substitute_option_leche de avena'));

    expect(await screen.findByText('leche de avena')).toBeInTheDocument();
    expect(screen.queryByTestId('ingredient_substitute_trigger_leche')).toBeNull();
    expect(confirmSubstitutionMock).toHaveBeenCalledWith({}, 'slot-1', 'leche', 'leche de avena');
  });

  test('a rejected confirmation reverts the optimistic update and shows the error', async () => {
    confirmSubstitutionMock.mockRejectedValueOnce(new FakeIngredientSubstitutionError('candidate is not a currently safe substitute'));
    const user = setupUser();
    renderWithProviders(<IngredientList ingredientes={['leche', 'tomate']} slotId="slot-1" />);

    await user.click(screen.getByTestId('ingredient_substitute_trigger_leche'));
    await user.click(await screen.findByTestId('ingredient_substitute_option_leche de avena'));

    expect(await screen.findByTestId('ingredient_substitute_error')).toHaveTextContent('candidate is not a currently safe substitute');
    expect(screen.getByTestId('ingredient_substitute_trigger_leche')).toBeInTheDocument();
  });

  test('no safe candidates shows the explicit empty message, never a blank list', async () => {
    getSafeSubstitutesMock.mockResolvedValueOnce([]);
    const user = setupUser();
    renderWithProviders(<IngredientList ingredientes={['quinoa']} slotId="slot-1" />);

    await user.click(screen.getByTestId('ingredient_substitute_trigger_quinoa'));

    expect(await screen.findByTestId('ingredient_substitute_none')).toBeInTheDocument();
  });
});
