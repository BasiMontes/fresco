import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as userProfileClient from '@/lib/client-api/user-profile';
import { useTourStore } from '@/lib/store/tour-store';
import { act, renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { navState, routerMock } from '@/tests/mocks/next-navigation';
import { FirstVisitTour } from './first-visit-tour';

/**
 * FRESCO-1197 — the first-visit tour overlay. It walks five stops, each opening the page it explains;
 * it can be skipped, closed or finished at any point; it marks itself as seen only when it started on
 * its own (a replay from Configuración changes nothing on the account); and it is a modal dialog:
 * focus moves in and comes back, Escape closes, the arrows move between stops.
 */

let markSpy: ReturnType<typeof spyOn>;

function setSmallScreen(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

beforeEach(() => {
  routerMock.push.mockClear();
  navState.pathname = '/menu';
  useTourStore.getState().clear();
  setSmallScreen(false);
  markSpy = spyOn(userProfileClient, 'markTourSeen').mockResolvedValue(undefined);
});

afterEach(() => {
  markSpy.mockRestore();
});

async function next(user: ReturnType<typeof setupUser>, times = 1) {
  for (let i = 0; i < times; i++) {
    await user.click(screen.getByTestId('tour_next_button'));
  }
}

describe('FirstVisitTour: opening', () => {
  test('opens on the first stop when it starts on its own, with progress and without Atrás', () => {
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByTestId('tour_title').textContent).toBe('Tu menú de hoy');
    expect(screen.getByTestId('tour_progress').textContent).toBe('1 de 5');
    expect(screen.queryByTestId('tour_back_button')).toBeNull();
    expect(screen.getByTestId('tour_skip_button')).toBeDefined();
    expect(screen.getByTestId('tour_next_button').textContent).toBe('Siguiente');
  });

  test('renders nothing when it does not start on its own and nobody asked for it', () => {
    renderWithProviders(<FirstVisitTour plan="free" autoStart={false} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('opens when a replay is requested and consumes the request', async () => {
    renderWithProviders(<FirstVisitTour plan="free" autoStart={false} />);

    act(() => { useTourStore.getState().requestReplay(); });

    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    expect(useTourStore.getState().replayRequested).toBe(false);
  });

  test('does not touch the page when its first stop is the page the person is already on', () => {
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

describe('FirstVisitTour: walking the stops', () => {
  test('Siguiente opens the page of the next stop and shows Atrás', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    await next(user);

    expect(screen.getByTestId('tour_title').textContent).toBe('Calendario: la semana entera');
    expect(screen.getByTestId('tour_progress').textContent).toBe('2 de 5');
    expect(routerMock.push).toHaveBeenCalledWith('/calendar');
    expect(screen.getByTestId('tour_back_button')).toBeDefined();
  });

  test('Atrás goes back one stop and opens its page', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);
    await next(user, 2);

    await user.click(screen.getByTestId('tour_back_button'));

    expect(screen.getByTestId('tour_title').textContent).toBe('Calendario: la semana entera');
    expect(routerMock.push).toHaveBeenLastCalledWith('/calendar');
  });

  test('the arrow keys move between stops', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('tour_progress').textContent).toBe('2 de 5');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('tour_progress').textContent).toBe('1 de 5');
  });

  test('the last stop drops Saltar and Siguiente becomes Empezar', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    await next(user, 4);

    expect(screen.getByTestId('tour_progress').textContent).toBe('5 de 5');
    expect(screen.queryByTestId('tour_skip_button')).toBeNull();
    expect(screen.getByTestId('tour_next_button').textContent).toBe('Empezar');
  });

  test('the plan stop reads for Free and for Pro', async () => {
    const user = setupUser();
    const { unmount } = renderWithProviders(<FirstVisitTour plan="free" autoStart />);
    await next(user, 4);
    expect(screen.getByTestId('tour_body').textContent).toContain('En Free');
    unmount();

    renderWithProviders(<FirstVisitTour plan="pro" autoStart />);
    await next(user, 4);
    expect(screen.getByTestId('tour_body').textContent).toContain('Con tu plan Pro');
  });

  test('stays usable when the zone of a stop is not on the page', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    await next(user);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByTestId('tour_spotlight').getAttribute('data-lifted')).toBe('false');
  });

  test('lifts the zone of the stop when it is on the page', async () => {
    const zone = document.createElement('div');
    zone.setAttribute('data-tour', 'menu-today');
    document.body.appendChild(zone);

    try {
      renderWithProviders(<FirstVisitTour plan="free" autoStart />);

      await waitFor(() => expect(screen.getByTestId('tour_spotlight').getAttribute('data-lifted')).toBe('true'));
    }
    finally {
      zone.remove();
    }
  });

  test('on a small screen the plan stop has no zone to lift: the card is centred over the dimmed page', async () => {
    setSmallScreen(true);
    const zone = document.createElement('div');
    zone.setAttribute('data-tour', 'account-plan');
    document.body.appendChild(zone);
    const user = setupUser();

    try {
      renderWithProviders(<FirstVisitTour plan="free" autoStart />);
      await next(user, 4);

      expect(screen.getByTestId('tour_spotlight').getAttribute('data-lifted')).toBe('false');
    }
    finally {
      zone.remove();
    }
  });
});

describe('FirstVisitTour: ending', () => {
  test('Saltar closes it and records it as seen when it started on its own', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    await user.click(screen.getByTestId('tour_skip_button'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(markSpy).toHaveBeenCalledTimes(1);
  });

  test('the close button closes it and records it as seen', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    await user.click(screen.getByTestId('tour_close_button'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(markSpy).toHaveBeenCalledTimes(1);
  });

  test('Escape closes it and records it as seen', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(markSpy).toHaveBeenCalledTimes(1);
  });

  test('Empezar closes it and records it as seen', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);
    await next(user, 4);

    await user.click(screen.getByTestId('tour_next_button'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(markSpy).toHaveBeenCalledTimes(1);
  });

  test('a replay changes nothing on the account', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart={false} />);
    act(() => { useTourStore.getState().requestReplay(); });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

    await user.click(screen.getByTestId('tour_skip_button'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(markSpy).not.toHaveBeenCalled();
  });

  test('closes even when recording it fails, and never shows an error to the person', async () => {
    markSpy.mockRejectedValue(new Error('rls denied'));
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    await user.click(screen.getByTestId('tour_skip_button'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('takes the person back to the page they were on when the tour opened', async () => {
    navState.pathname = '/profile';
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);
    navState.pathname = '/calendar';
    await next(user);
    routerMock.push.mockClear();

    await user.click(screen.getByTestId('tour_close_button'));

    expect(routerMock.push).toHaveBeenCalledWith('/profile');
  });

  test('does not move the person when they are already on the page they started from', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);

    await user.click(screen.getByTestId('tour_close_button'));

    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

describe('FirstVisitTour: dialog behaviour', () => {
  test('is a modal dialog labelled by its title', () => {
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);
    const dialog = screen.getByRole('dialog');

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByTestId('tour_title').id);
  });

  test('moves focus to the title of each stop', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('tour_title')));

    await next(user);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('tour_title')));
  });

  test('gives focus back to what had it before the tour opened', async () => {
    const user = setupUser();
    renderWithProviders(
      <>
        <button type="button" data-testid="origin_button">Configuración</button>
        <FirstVisitTour plan="free" autoStart={false} />
      </>,
    );
    screen.getByTestId('origin_button').focus();
    act(() => { useTourStore.getState().requestReplay(); });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

    await user.click(screen.getByTestId('tour_close_button'));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('origin_button')));
  });

  test('keeps Tab inside the card: from the last control it goes back to the first', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);
    screen.getByTestId('tour_next_button').focus();

    await user.tab();

    expect(document.activeElement).toBe(screen.getByTestId('tour_close_button'));
  });

  test('and Shift+Tab from the first control goes to the last one', async () => {
    const user = setupUser();
    renderWithProviders(<FirstVisitTour plan="free" autoStart />);
    screen.getByTestId('tour_close_button').focus();

    await user.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByTestId('tour_next_button'));
  });
});
