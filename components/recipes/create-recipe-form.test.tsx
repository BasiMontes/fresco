import type { RecetaPropia } from '@schemas';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { CreateRecipeForm } from './create-recipe-form';

/**
 * FRESCO-419 — `CreateRecipeForm` requires a non-empty name (touched-gated,
 * same shape as `NombreForm`) and swaps its copy + prefills between create
 * and edit mode. These tests pin the validation gate and the mode swap;
 * they never fire a successful submit, so no `@/lib/api/recipes` mock is
 * needed (and the dialog never runs its close transition — see ADR-0024).
 */

describe('CreateRecipeForm', () => {
  test('keeps Save disabled and silent until the name field is dirtied', () => {
    renderWithProviders(<CreateRecipeForm open onOpenChange={() => {}} onCreated={() => {}} />);

    expect(screen.getByTestId('guardar_receta_button')).toBeDisabled();
    expect(screen.queryByTestId('receta_nombre_validation_message')).toBeNull();
  });

  test('shows the required-name error once the field is dirtied to empty', async () => {
    const user = setupUser();
    renderWithProviders(<CreateRecipeForm open onOpenChange={() => {}} onCreated={() => {}} />);

    await user.type(screen.getByTestId('receta_nombre_input'), 'x');
    await user.clear(screen.getByTestId('receta_nombre_input'));

    expect(screen.getByTestId('receta_nombre_validation_message')).toHaveTextContent(
      'Indica un nombre para guardar la receta.',
    );
    expect(screen.getByTestId('guardar_receta_button')).toBeDisabled();
  });

  test('enables Save once a name is present', async () => {
    const user = setupUser();
    renderWithProviders(<CreateRecipeForm open onOpenChange={() => {}} onCreated={() => {}} />);

    await user.type(screen.getByTestId('receta_nombre_input'), 'Tortilla');

    expect(screen.getByTestId('guardar_receta_button')).toBeEnabled();
    expect(screen.getByTestId('guardar_receta_button')).toHaveTextContent('Guardar receta');
  });

  test('submitting via Enter with an empty name shows the error and does not close', async () => {
    const user = setupUser();
    let open = true;
    renderWithProviders(
      <CreateRecipeForm open onOpenChange={(v) => { open = v; }} onCreated={() => {}} />,
    );

    // Enter in the name field submits the form even with the button disabled
    await user.type(screen.getByTestId('receta_nombre_input'), 'x{backspace}{enter}');

    expect(screen.getByTestId('receta_nombre_validation_message')).toBeInTheDocument();
    expect(open).toBe(true);
  });

  test('renders edit-mode copy and pre-fills every field from the recipe', () => {
    const receta = { id: 'r1', nombre: 'Gazpacho', ingredientes: ['tomate', 'pepino'], pasos: ['triturar'], created_at: '', updated_at: '', user_id: 'u1' } satisfies RecetaPropia;
    renderWithProviders(
      <CreateRecipeForm open onOpenChange={() => {}} onCreated={() => {}} receta={receta} />,
    );

    expect(screen.getByRole('heading', { name: 'Editar receta' })).toBeInTheDocument();
    expect(screen.getByTestId('receta_nombre_input')).toHaveValue('Gazpacho');
    expect(screen.getByTestId('receta_ingredientes_input')).toHaveValue('tomate\npepino');
    expect(screen.getByTestId('receta_pasos_input')).toHaveValue('triturar');
    expect(screen.getByTestId('guardar_receta_button')).toHaveTextContent('Guardar cambios');
  });

  test('re-syncs the fields when the dialog is reopened with a different recipe', async () => {
    const first = { id: 'r1', nombre: 'Gazpacho', ingredientes: [], pasos: [], created_at: '', updated_at: '', user_id: 'u1' } satisfies RecetaPropia;
    const second = { id: 'r2', nombre: 'Salmorejo', ingredientes: [], pasos: [], created_at: '', updated_at: '', user_id: 'u1' } satisfies RecetaPropia;
    const { rerender } = renderWithProviders(
      <CreateRecipeForm open={false} onOpenChange={() => {}} onCreated={() => {}} receta={first} />,
    );

    rerender(<CreateRecipeForm open onOpenChange={() => {}} onCreated={() => {}} receta={second} />);

    expect(screen.getByTestId('receta_nombre_input')).toHaveValue('Salmorejo');
  });
});
