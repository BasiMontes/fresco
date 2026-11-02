import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import GlobalError from './global-error';

// FRESCO-1079 — when the root layout itself fails, this page replaces it, so it owns the <html> and
// <body>. The document it owns is checked on the rendered markup; the retry click and the log on
// mount are checked with one render into the test DOM.

let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;
const retry = mock(() => {});

beforeEach(() => {
  retry.mockClear();
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => { errorSpy.mockRestore(); });

describe('GlobalError', () => {
  test('owns the document: Spanish <html>, a <body> and the message as an alert', () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error('boom')} unstable_retry={retry} />);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<body>');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Algo salió mal');
  });

  test('offers a retry button', () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error('boom')} unstable_retry={retry} />);
    expect(html).toContain('data-testid="global_error_retry_button"');
    expect(html).toContain('Intentar de nuevo');
  });

  test('clicking retry calls the retry handler and the error is logged on mount', async () => {
    const error = new Error('boom');
    renderWithProviders(<GlobalError error={error} unstable_retry={retry} />);
    await setupUser().click(screen.getByTestId('global_error_retry_button'));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[app/global-error] uncaught root-layout error', error);
  });
});
