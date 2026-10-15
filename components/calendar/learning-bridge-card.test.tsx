import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { LearningBridgeCard } from './learning-bridge-card';
import '@/tests/mocks/next-navigation';

/** FRESCO-968 (UX-16) — the "Cerrar" control of the help card is a >= 24px target. */

describe('LearningBridgeCard', () => {
  test('close button has a padded hit area of at least 24px', () => {
    renderWithProviders(<LearningBridgeCard plan="free" hasMarks={false} />);

    const close = screen.getByTestId('learning_bridge_dismiss');
    expect(close).toHaveClass('p-2');
    expect(close).toHaveClass('-m-2');
  });
});
