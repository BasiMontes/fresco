import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { HealthConsentBlock } from '@/components/onboarding/health-consent-block';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';

// FRESCO-1174 — while the consent POST is pending the box shows ticked with a "Guardando…" status and the
// "Marca la casilla" hint is gone; a failed save puts everything back and says so.

let fetchSpy: ReturnType<typeof spyOn>;
let resolveFetch: (response: Response) => void;

beforeEach(() => {
  const pending = new Promise<Response>((resolve) => { resolveFetch = resolve; });
  fetchSpy = spyOn(globalThis, 'fetch').mockReturnValue(pending);
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('HealthConsentBlock', () => {
  test('while the POST is pending: ticked, "Guardando…", and no "Marca la casilla" hint', async () => {
    const user = setupUser();
    renderWithProviders(<HealthConsentBlock consented={false} onConsentedChange={() => {}} />);
    expect(screen.getByTestId('health_consent_required_hint')).toBeTruthy();

    await user.click(screen.getByTestId('health_consent_checkbox'));

    await waitFor(() => expect(screen.getByTestId('health_consent_saving')).toHaveTextContent('Guardando…'));
    expect(screen.getByTestId<HTMLInputElement>('health_consent_checkbox').checked).toBe(true);
    expect(screen.queryByTestId('health_consent_required_hint')).toBeNull();
  });

  test('when the POST fails the box goes back to unticked and the error shows', async () => {
    const user = setupUser();
    renderWithProviders(<HealthConsentBlock consented={false} onConsentedChange={() => {}} />);
    await user.click(screen.getByTestId('health_consent_checkbox'));
    await waitFor(() => expect(screen.getByTestId('health_consent_saving')).toBeTruthy());

    resolveFetch(new Response('{}', { status: 500 }));

    await waitFor(() => expect(screen.getByTestId('health_consent_error_message')).toBeTruthy());
    expect(screen.queryByTestId('health_consent_saving')).toBeNull();
    expect(screen.getByTestId<HTMLInputElement>('health_consent_checkbox').checked).toBe(false);
  });
});
