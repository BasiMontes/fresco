import { beforeEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { GenerateWeekButton } from './generate-week-button';

/**
 * FRESCO-409 — `GenerateWeekButton` disables itself and shows a fixed
 * message for a week that has already passed (`fechaInicio` < this week's
 * Monday), before any network call. That guard is the branch worth
 * pinning; the 422/409 error mapping is left to e2e (it needs the full
 * Supabase + Edge Function mock surface).
 */

const PAST_MONDAY = '2020-01-06';
const FUTURE_MONDAY = '2999-01-04';

describe('GenerateWeekButton', () => {
  beforeEach(() => {
    routerMock.refresh.mockClear();
  });

  test('renders an enabled generate button for a non-past week', () => {
    renderWithProviders(<GenerateWeekButton semanaIso="2999-W01" fechaInicio={FUTURE_MONDAY} />);

    const button = screen.getByTestId('generate_week_button');
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Generar mi menú');
    expect(screen.queryByTestId('generate_week_error_message')).toBeNull();
  });

  test('disables the button and explains why for a past week', () => {
    renderWithProviders(<GenerateWeekButton semanaIso="2020-W02" fechaInicio={PAST_MONDAY} />);

    expect(screen.getByTestId('generate_week_button')).toBeDisabled();
    expect(screen.getByTestId('generate_week_error_message')).toHaveTextContent(
      'No se pueden planificar semanas que ya han pasado.',
    );
  });

  test('does not navigate when the disabled past-week button is clicked', async () => {
    renderWithProviders(<GenerateWeekButton semanaIso="2020-W02" fechaInicio={PAST_MONDAY} />);

    screen.getByTestId('generate_week_button').click();

    expect(routerMock.refresh).not.toHaveBeenCalled();
  });
});
