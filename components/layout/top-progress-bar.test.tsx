import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { navState } from '@/tests/mocks/next-navigation';
import { TopProgressBar } from './top-progress-bar';

/**
 * FRESCO-482 — the bar only exists after a navigation commits, and a new
 * commit re-mounts it (bumped key) so its CSS sweep replays. The animation
 * itself is CSS (`.top-progress-bar` in `app/globals.css`) and not asserted
 * here.
 */
describe('TopProgressBar', () => {
  afterEach(() => {
    navState.pathname = '/';
    navState.searchParams = new URLSearchParams();
  });

  test('renders nothing on first mount', () => {
    renderWithProviders(<TopProgressBar />);
    expect(screen.queryByTestId('top_progress_bar')).not.toBeInTheDocument();
  });

  test('shows the bar once the pathname changes', () => {
    const { rerender } = renderWithProviders(<TopProgressBar />);
    navState.pathname = '/menu';
    rerender(<TopProgressBar />);
    expect(screen.getByTestId('top_progress_bar')).toBeInTheDocument();
  });

  test('re-mounts the bar on each subsequent navigation', () => {
    const { rerender } = renderWithProviders(<TopProgressBar />);

    navState.pathname = '/menu';
    rerender(<TopProgressBar />);
    const first = screen.getByTestId('top_progress_bar');

    navState.pathname = '/calendar';
    rerender(<TopProgressBar />);
    const second = screen.getByTestId('top_progress_bar');

    // A fresh element (new React key), not the same node kept in place.
    expect(second).not.toBe(first);
  });

  test('is decorative — aria-hidden, not a status role', () => {
    const { rerender } = renderWithProviders(<TopProgressBar />);
    navState.pathname = '/menu';
    rerender(<TopProgressBar />);
    expect(screen.getByTestId('top_progress_bar')).toHaveAttribute('aria-hidden', 'true');
  });
});
