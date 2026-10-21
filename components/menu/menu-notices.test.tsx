import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { MarkedDish } from '@/lib/menu/pro-would-have-excluded';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as posthogEvents from '@/lib/posthog/events';
import { renderWithProviders, screen } from '@/tests/component-render';
import { MenuNotices } from './menu-notices';

function planWith(overrides: Partial<MenuSemanalPersistido> = {}): MenuSemanalPersistido {
  return { mealPlanId: 'plan-1', semanaIso: '2026-W43', menu: {}, ...overrides } as MenuSemanalPersistido;
}

const DISH: MarkedDish = { id: 'r1', nombre: 'Lentejas estofadas', estado: 'descartada' };

describe('MenuNotices (FRESCO-1027)', () => {
  let capture: ReturnType<typeof spyOn>;
  beforeEach(() => { capture = spyOn(posthogEvents, 'captureEvent').mockImplementation(() => {}); });
  afterEach(() => { capture.mockRestore(); });

  test('paints nothing for a signed-in user with no warning, no explanation and no preview', () => {
    const { container } = renderWithProviders(<MenuNotices plan={planWith()} isAnonymous={false} proPreview={[]} />);

    expect(container.firstChild).toBeNull();
  });

  test('a Free user with a matching dish sees the Pro preview', () => {
    renderWithProviders(<MenuNotices plan={planWith()} isAnonymous={false} proPreview={[DISH]} />);

    expect(screen.getByTestId('pro_preview_notice')).toBeTruthy();
    expect(screen.queryByTestId('learning_explanation_card')).toBeNull();
  });

  test('a Pro user with an explanation sees it and fires learning_explanation_viewed once', () => {
    renderWithProviders(<MenuNotices plan={planWith({ explicacionAprendizaje: 'Evitamos 2 platos que descartaste.' })} isAnonymous={false} proPreview={[]} />);

    expect(screen.getByTestId('learning_explanation_card')).toHaveTextContent('Evitamos 2 platos que descartaste.');
    expect((capture.mock.calls as unknown[][]).filter(call => call[0] === 'learning_explanation_viewed')).toHaveLength(1);
    expect(screen.queryByTestId('pro_preview_notice')).toBeNull();
  });
});
