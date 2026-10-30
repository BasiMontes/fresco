import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as clientApi from '@/lib/client-api/user-profile';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { NombreForm } from './nombre-form';

/**
 * FRESCO-1072 (coverage tranche 4) — the save itself, which `nombre-form.test.tsx` does not exercise: what is
 * sent (the trimmed name), what the user sees (saved, saving, failed), and that the page re-reads the name
 * after a save (FRESCO-179) but not after a failed one. Plain property assertions on purpose: a failing
 * jest-dom matcher makes bun print the whole DOM, which can take minutes.
 */

let update: ReturnType<typeof spyOn<typeof clientApi, 'updateNombre'>>;
let consoleError: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  routerMock.refresh.mockClear();
  update = spyOn(clientApi, 'updateNombre').mockResolvedValue(undefined);
  consoleError = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  update.mockRestore();
  consoleError.mockRestore();
});

const input = () => screen.getByTestId<HTMLInputElement>('nombre_input');
const saveButton = () => screen.getByTestId<HTMLButtonElement>('guardar_nombre_button');

describe('NombreForm — saving', () => {
  test('sends the trimmed name, not the raw field', async () => {
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);
    await user.clear(input());
    await user.type(input(), '  Ana María  ');

    await user.click(saveButton());

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toBe('Ana María');
  });

  test('a first-time user (no name yet) can save the first one', async () => {
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial={null} />);
    await user.type(input(), 'Marta');

    await user.click(saveButton());

    await waitFor(() => expect(update).toHaveBeenCalledWith('Marta'));
  });

  test('a successful save says so and asks the page to re-read the name for the greeting and the sidebar', async () => {
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);
    await user.type(input(), ' M');

    await user.click(saveButton());

    expect((await screen.findByTestId('nombre_saved_message')).textContent).toBe('Nombre guardado.');
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  test('typing again takes the saved message away', async () => {
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);
    await user.type(input(), ' M');
    await user.click(saveButton());
    await screen.findByTestId('nombre_saved_message');

    await user.type(input(), 'x');

    expect(screen.queryByTestId('nombre_saved_message')).toBeNull();
  });

  test('while saving the button is off, so a second click cannot send the name twice', async () => {
    let finish: () => void = () => {};
    update.mockImplementation(async () => new Promise<never>((resolve) => { finish = () => resolve(undefined as never); }));
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);
    await user.type(input(), ' M');

    await user.click(saveButton());

    await waitFor(() => expect(saveButton().disabled).toBe(true));
    await user.click(saveButton());
    expect(update).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByTestId('nombre_saved_message');
  });

  test('a failed save shows an error, logs the cause, does not claim it was saved and does not refresh the page', async () => {
    update.mockRejectedValue(new Error('rls'));
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);
    await user.type(input(), ' M');

    await user.click(saveButton());

    expect((await screen.findByTestId('nombre_save_error_message')).textContent).toBe('No se pudo guardar tu nombre. Inténtalo de nuevo.');
    expect(screen.queryByTestId('nombre_saved_message')).toBeNull();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    expect(saveButton().disabled).toBe(false);
  });

  test('typing after a failed save clears the error marks at once', async () => {
    update.mockRejectedValue(new Error('rls'));
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);
    await user.type(input(), ' M');
    await user.click(saveButton());
    await screen.findByTestId('nombre_save_error_message');
    const wrap = screen.getByTestId('nombre_save_wrap');
    expect(wrap.classList.contains('is-error')).toBe(true);

    await user.type(input(), 'x');

    expect(wrap.classList.contains('is-error')).toBe(false);
  });

  test('a retry after a failed save sends the name again and clears the error', async () => {
    update.mockRejectedValueOnce(new Error('rls'));
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);
    await user.type(input(), ' M');
    await user.click(saveButton());
    await screen.findByText('No se pudo guardar tu nombre. Inténtalo de nuevo.');

    await user.click(saveButton());

    expect((await screen.findByTestId('nombre_saved_message')).textContent).toBe('Nombre guardado.');
    expect(screen.queryByText('No se pudo guardar tu nombre. Inténtalo de nuevo.')).toBeNull();
    expect(update).toHaveBeenCalledTimes(2);
  });

  test('submitting an empty name with Enter sends nothing', async () => {
    const user = setupUser();
    renderWithProviders(<NombreForm nombreInicial="Laura" />);
    await user.clear(input());

    await user.type(input(), '{enter}');

    expect(update).not.toHaveBeenCalled();
  });
});
