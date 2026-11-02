import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import ErrorPage from './error';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — the root safety net: an uncaught rendering error falls back to a branded page that
// logs the error, lets the user retry the failed segment, and always offers a safe way out.

let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;
const retry = mock(() => {});

beforeEach(() => {
  retry.mockClear();
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => { errorSpy.mockRestore(); });

describe('ErrorPage', () => {
  test('tells the user something went wrong, as an alert', () => {
    renderWithProviders(<ErrorPage error={new Error('boom')} unstable_retry={retry} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Algo salió mal');
    expect(screen.getByRole('alert')).toHaveTextContent('problema inesperado');
  });

  test('logs the error that caused it', () => {
    const error = new Error('boom');
    renderWithProviders(<ErrorPage error={error} unstable_retry={retry} />);
    expect(errorSpy).toHaveBeenCalledWith('[app/error] uncaught error', error);
  });

  test('retrying re-renders the failed segment', async () => {
    renderWithProviders(<ErrorPage error={new Error('boom')} unstable_retry={retry} />);
    await setupUser().click(screen.getByTestId('error_retry_button'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('always offers the way back to the menu', () => {
    renderWithProviders(<ErrorPage error={new Error('boom')} unstable_retry={retry} />);
    expect(screen.getByTestId('error_home_link')).toHaveAttribute('href', '/menu');
  });
});
