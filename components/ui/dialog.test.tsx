import { describe, expect, mock, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import { Dialog } from '@/components/ui/dialog';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';

/** FRESCO-1007 — `dismissible={false}` makes the dialog blocking; the default keeps closing on all three paths. */

function setup(dismissible?: boolean) {
  const onOpenChange = mock((_open: boolean) => {});
  renderWithProviders(
    <Dialog open onOpenChange={onOpenChange} aria-label="Prueba" data-testid="probe" dismissible={dismissible}>
      <button type="button">dentro</button>
    </Dialog>,
  );
  return { onOpenChange, user: setupUser() };
}

describe('Dialog dismissible', () => {
  test('by default the close button, Escape and the scrim all ask to close', async () => {
    const { onOpenChange, user } = setup();

    await user.click(screen.getByTestId('probe_close_button'));
    await user.keyboard('{Escape}');
    await user.click(screen.getByTestId('probe').parentElement as HTMLElement);

    expect(onOpenChange).toHaveBeenCalledTimes(3);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('dismissible={false} removes the close button and ignores Escape and the scrim', async () => {
    const { onOpenChange, user } = setup(false);

    expect(screen.queryByTestId('probe_close_button')).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(screen.getByTestId('probe').parentElement as HTMLElement);

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

/**
 * FRESCO-1035: a Dialog that is open from the first render is rendered on the server by the app layout
 * (the re-consent dialog), where `document` does not exist. It used to throw `ReferenceError: document is
 * not defined` and every route of that account answered 500.
 */
describe('Dialog open from the first render', () => {
  test('renders nothing on the server instead of throwing', () => {
    const realDocument = globalThis.document;
    // @ts-expect-error simulate the server: the test setup registers a DOM, a real server has none
    delete globalThis.document;
    try {
      const html = renderToString(
        <Dialog open onOpenChange={() => {}} aria-label="Prueba" dismissible={false}>
          <button type="button">dentro</button>
        </Dialog>,
      );

      expect(html).toBe('');
    }
    finally {
      globalThis.document = realDocument;
    }
  });

  test('on the client it appears and takes the focus', async () => {
    setup(false);

    expect(await screen.findByTestId('probe')).toBeInTheDocument();
    // The first focusable element inside takes the focus, as before: `mounted` must not leave it behind.
    await waitFor(() => expect(screen.getByRole('button', { name: 'dentro' })).toHaveFocus());
  });
});
