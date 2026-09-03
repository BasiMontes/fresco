import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { NombreForm } from './nombre-form';
import '@/tests/mocks/next-navigation';

/**
 * FRESCO-409 — `NombreForm` gates its Save button on a non-empty, changed
 * name (whitespace trimmed) and shows the "indica un nombre" error only
 * after the field is touched. Tests pin both gates.
 */

describe('NombreForm', () => {
  test('shows no validation error before the field is touched', () => {
    renderWithProviders(<NombreForm nombreInicial={null} />);

    expect(screen.queryByTestId('nombre_validation_message')).toBeNull();
    expect(screen.getByTestId('guardar_nombre_button')).toBeDisabled();
  });

  test('shows the error once the field is dirtied to empty', async () => {
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);

    await user.clear(screen.getByTestId('nombre_input'));

    expect(screen.getByTestId('nombre_validation_message')).toHaveTextContent('Indica un nombre para guardar.');
    expect(screen.getByTestId('guardar_nombre_button')).toBeDisabled();
  });

  test('keeps Save disabled while the name is unchanged', async () => {
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);

    await user.type(screen.getByTestId('nombre_input'), '{backspace}a');

    expect(screen.getByTestId('guardar_nombre_button')).toBeDisabled();
  });

  test('enables Save once the name is both non-empty and changed', async () => {
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);

    await user.type(screen.getByTestId('nombre_input'), ' M');

    expect(screen.getByTestId('guardar_nombre_button')).toBeEnabled();
  });

  test('trims whitespace-only input back to invalid', async () => {
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);

    await user.clear(screen.getByTestId('nombre_input'));
    await user.type(screen.getByTestId('nombre_input'), '   ');

    expect(screen.getByTestId('nombre_validation_message')).toBeInTheDocument();
    expect(screen.getByTestId('guardar_nombre_button')).toBeDisabled();
  });
});
