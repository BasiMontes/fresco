import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { renderWithProviders, screen } from '@/tests/component-render';
import { Reveal } from './reveal';

/**
 * FRESCO-446 — `Reveal` wraps a landing section and settles it into view on
 * scroll. happy-dom ships no `IntersectionObserver`, so each test installs a
 * controllable stub (or removes it) and drives the intersection / scroll
 * paths by hand.
 */

interface StubObserver {
  callback: IntersectionObserverCallback
  observed: Element[]
  disconnected: boolean
}

let observers: StubObserver[];
const realIO = globalThis.IntersectionObserver;
// eslint-disable-next-line ts/unbound-method -- captured only to restore verbatim in afterEach
const realGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const realInnerHeight = globalThis.innerHeight;

function installStubIO() {
  observers = [];
  globalThis.IntersectionObserver = class {
    private readonly entry: StubObserver;
    constructor(callback: IntersectionObserverCallback) {
      this.entry = { callback, observed: [], disconnected: false };
      observers.push(this.entry);
    }

    observe(el: Element) {
      this.entry.observed.push(el);
    }

    disconnect() {
      this.entry.disconnected = true;
    }

    unobserve() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

function fireIntersection(isIntersecting: boolean) {
  act(() => {
    for (const o of observers) {
      o.callback(
        [{ isIntersecting, target: o.observed[0] } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    }
  });
}

/**
 * Move the wrapper's reported top edge, fire a window scroll event, then
 * flush the single rAF frame `Reveal` defers its layout read to (FRESCO-721
 * — the read is scheduled a frame out so it never forces a synchronous
 * reflow off the back of the scroll handler itself).
 */
async function scrollWrapperTo(el: HTMLElement, top: number) {
  el.getBoundingClientRect = () => ({ top } as DOMRect);
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
}

/** Flush the single rAF frame `Reveal` defers its initial mount check to. */
async function flushMountCheck() {
  await act(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
}

afterEach(() => {
  globalThis.IntersectionObserver = realIO;
  Element.prototype.getBoundingClientRect = realGetBoundingClientRect;
  globalThis.innerHeight = realInnerHeight;
});

describe('Reveal', () => {
  describe('with IntersectionObserver', () => {
    beforeEach(() => {
      installStubIO();
      // Default: wrapper sits well below the fold on mount.
      window.innerHeight = 800;
      Element.prototype.getBoundingClientRect = () => ({ top: 5000 } as DOMRect);
    });

    test('renders its children', () => {
      renderWithProviders(<Reveal><p>contenido</p></Reveal>);
      expect(screen.getByText('contenido')).toBeInTheDocument();
    });

    test('marks the wrapper after mount but stays unrevealed while off-screen', () => {
      renderWithProviders(<Reveal><p>contenido</p></Reveal>);
      const wrapper = screen.getByText('contenido').parentElement as HTMLElement;

      expect(wrapper).toHaveAttribute('data-reveal');
      expect(wrapper).not.toHaveAttribute('data-revealed');
    });

    test('reveals once the section intersects the viewport', () => {
      renderWithProviders(<Reveal><p>contenido</p></Reveal>);
      const wrapper = screen.getByText('contenido').parentElement as HTMLElement;

      fireIntersection(false);
      expect(wrapper).not.toHaveAttribute('data-revealed');

      fireIntersection(true);
      expect(wrapper).toHaveAttribute('data-revealed');
      expect(observers[0].disconnected).toBe(true);
    });

    test('scroll fallback ignores a section still below the 85% line, then reveals it once it rises past', async () => {
      renderWithProviders(<Reveal><p>contenido</p></Reveal>);
      const wrapper = screen.getByText('contenido').parentElement as HTMLElement;

      await scrollWrapperTo(wrapper, 700); // top edge below 0.85 * 800 = 680 → not yet
      expect(wrapper).not.toHaveAttribute('data-revealed');

      await scrollWrapperTo(wrapper, 400); // now within the visible 85% of the viewport
      expect(wrapper).toHaveAttribute('data-revealed');
      expect(observers[0].disconnected).toBe(true);
    });

    test('reveals on mount, a frame later, when already in view', async () => {
      Element.prototype.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
      renderWithProviders(<Reveal><p>contenido</p></Reveal>);
      const wrapper = screen.getByText('contenido').parentElement as HTMLElement;

      await flushMountCheck();
      expect(wrapper).toHaveAttribute('data-revealed');
    });
  });

  test('reveals immediately when IntersectionObserver is unavailable', () => {
    // @ts-expect-error — exercising the no-observer branch
    delete globalThis.IntersectionObserver;
    renderWithProviders(<Reveal><p>contenido</p></Reveal>);
    const wrapper = screen.getByText('contenido').parentElement as HTMLElement;

    expect(wrapper).toHaveAttribute('data-revealed');
  });
});
