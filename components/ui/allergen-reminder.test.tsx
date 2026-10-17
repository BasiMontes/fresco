import { describe, expect, test } from 'bun:test';
import { ALERGENOS_RECORDATORIO } from '@/lib/constants/dietary-options';
import { renderWithProviders, screen } from '@/tests/component-render';
import { AllergenReminder } from './allergen-reminder';

/** FRESCO-1000 — one reminder, one text, on the menu and on every recipe. */
describe('AllergenReminder', () => {
  test('shows the shared reminder text', () => {
    renderWithProviders(<AllergenReminder />);

    expect(screen.getByTestId('alergenos_recordatorio')).toHaveTextContent(ALERGENOS_RECORDATORIO);
  });

  test('accepts a class from the screen that places it', () => {
    renderWithProviders(<AllergenReminder className="mt-2" />);

    expect(screen.getByTestId('alergenos_recordatorio')).toHaveClass('mt-2');
  });
});
