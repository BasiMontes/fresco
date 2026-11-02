import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { fireEvent, renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { HorizontalScrollRow } from './horizontal-scroll-row';

// FRESCO-1077 — the arrows of a horizontally scrolling row appear only when there
// is something behind them, and scroll by one card, smoothly unless the user asked
// for reduced motion. The layout numbers are stubbed (the test DOM has no layout).

const metrics = { scrollLeft: 0, scrollWidth: 1000, clientWidth: 400 };
const scrollBy = mock((_options: ScrollToOptions) => {});
let reducedMotion = false;
let resizeCallback: (() => void) | null = null;

const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
const saved: Record<string, PropertyDescriptor | undefined> = {};
const realResizeObserver = globalThis.ResizeObserver;
const realMatchMedia = window.matchMedia.bind(window);

beforeEach(() => {
  Object.assign(metrics, { scrollLeft: 0, scrollWidth: 1000, clientWidth: 400 });
  scrollBy.mockClear();
  reducedMotion = false;
  resizeCallback = null;
  for (const key of ['scrollLeft', 'scrollWidth', 'clientWidth', 'scrollBy']) {
    saved[key] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key);
  }
  for (const key of ['scrollLeft', 'scrollWidth', 'clientWidth'] as const) {
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => metrics[key] });
  }
  proto.scrollBy = scrollBy;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { resizeCallback = callback; }
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({ matches: reducedMotion, media: query })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  for (const [key, descriptor] of Object.entries(saved)) {
    if (descriptor) { Object.defineProperty(HTMLElement.prototype, key, descriptor); }
    else { Reflect.deleteProperty(HTMLElement.prototype, key); }
  }
  globalThis.ResizeObserver = realResizeObserver;
  window.matchMedia = realMatchMedia;
});

function renderRow() {
  return renderWithProviders(<HorizontalScrollRow className="extra"><div data-testid="card">a</div></HorizontalScrollRow>);
}

describe('HorizontalScrollRow', () => {
  test('renders its children inside the scroller with the extra class', () => {
    renderRow();
    expect(screen.getByTestId('card').parentElement).toHaveClass('overflow-x-auto', 'extra');
  });

  test('at the start only the forward arrow shows', async () => {
    renderRow();
    await waitFor(() => expect(screen.getByLabelText('Ver recetas siguientes')).toBeInTheDocument());
    expect(screen.queryByLabelText('Ver recetas anteriores')).toBeNull();
  });

  test('when everything fits there are no arrows at all', async () => {
    metrics.scrollWidth = 400;
    renderRow();
    await waitFor(() => expect(resizeCallback).not.toBeNull());
    expect(screen.queryByLabelText('Ver recetas siguientes')).toBeNull();
    expect(screen.queryByLabelText('Ver recetas anteriores')).toBeNull();
  });

  test('scrolling into the middle shows both arrows', async () => {
    renderRow();
    metrics.scrollLeft = 200;
    fireEvent.scroll(screen.getByTestId('card').parentElement!);
    await waitFor(() => expect(screen.getByLabelText('Ver recetas anteriores')).toBeInTheDocument());
    expect(screen.getByLabelText('Ver recetas siguientes')).toBeInTheDocument();
  });

  test('at the very end (within 1px) the forward arrow is gone', async () => {
    renderRow();
    metrics.scrollLeft = 599.5;
    fireEvent.scroll(screen.getByTestId('card').parentElement!);
    await waitFor(() => expect(screen.queryByLabelText('Ver recetas siguientes')).toBeNull());
    expect(screen.getByLabelText('Ver recetas anteriores')).toBeInTheDocument();
  });

  test('a resize recomputes the arrows', async () => {
    metrics.scrollWidth = 400;
    renderRow();
    await waitFor(() => expect(resizeCallback).not.toBeNull());
    metrics.scrollWidth = 1000;
    resizeCallback?.();
    await waitFor(() => expect(screen.getByLabelText('Ver recetas siguientes')).toBeInTheDocument());
  });

  test('the forward arrow scrolls one card, smoothly', async () => {
    renderRow();
    await setupUser().click(await screen.findByLabelText('Ver recetas siguientes'));
    expect(scrollBy).toHaveBeenCalledWith({ left: 272, behavior: 'smooth' });
  });

  test('the back arrow scrolls one card the other way, without animation for reduced motion', async () => {
    reducedMotion = true;
    renderRow();
    metrics.scrollLeft = 300;
    fireEvent.scroll(screen.getByTestId('card').parentElement!);
    await setupUser().click(await screen.findByLabelText('Ver recetas anteriores'));
    expect(scrollBy).toHaveBeenCalledWith({ left: -272, behavior: 'auto' });
  });
});
