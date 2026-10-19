import { describe, expect, mock, test } from 'bun:test';
import { Dialog } from '@/components/ui/dialog';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';

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
