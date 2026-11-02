import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRef } from 'react';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { fireEvent, renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { OnboardingStepHousehold } from './onboarding-step-household';

// FRESCO-1078 — wizard step 3. The step writes household size and budget straight
// into the shared onboarding store; the parent decides validity. Pinned here: what
// reaches the store, and which message shows when (the budget one only after blur).

const VALID = { valid: true, message: null };

function renderStep(props: Partial<React.ComponentProps<typeof OnboardingStepHousehold>> = {}) {
  return renderWithProviders(
    <OnboardingStepHousehold
      headingRef={createRef<HTMLHeadingElement>()}
      household={VALID}
      presupuestoValid
      hasInvalidPlanning={false}
      {...props}
    />,
  );
}

beforeEach(() => { useOnboardingStore.getState().reset(); });
afterEach(() => { useOnboardingStore.getState().reset(); });

describe('OnboardingStepHousehold', () => {
  test('shows the stored household size and an empty optional budget', () => {
    renderStep();
    expect(screen.getByTestId('adultos_input')).toHaveValue(2);
    expect(screen.getByTestId('presupuesto_input')).toHaveValue(null);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('¿Quiénes cocináis en casa?');
  });

  test('typing adults and children writes them to the store as numbers', () => {
    renderStep();
    fireEvent.change(screen.getByTestId('adultos_input'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('ninos_input'), { target: { value: '1' } });
    expect(useOnboardingStore.getState().adultos).toBe(3);
    expect(useOnboardingStore.getState().ninos).toBe(1);
  });

  test('the budget is stored as a number, and clearing it stores null', () => {
    renderStep();
    fireEvent.change(screen.getByTestId('presupuesto_input'), { target: { value: '80' } });
    expect(useOnboardingStore.getState().presupuestoSemanaEuros).toBe(80);
    fireEvent.change(screen.getByTestId('presupuesto_input'), { target: { value: '' } });
    expect(useOnboardingStore.getState().presupuestoSemanaEuros).toBeNull();
  });

  test('an invalid household shows its message in an alert', () => {
    renderStep({ household: { valid: false, message: 'Indica al menos un adulto en el hogar.' } });
    expect(screen.getByTestId('household_validation_message')).toHaveTextContent('Indica al menos un adulto');
  });

  test('a valid household shows no household message', () => {
    renderStep();
    expect(screen.queryByTestId('household_validation_message')).toBeNull();
  });

  test('an invalid budget stays quiet on a pristine field and speaks after the field is left', async () => {
    renderStep({ presupuestoValid: false });
    expect(screen.queryByTestId('presupuesto_validation_message')).toBeNull();
    const user = setupUser();
    await user.click(screen.getByTestId('presupuesto_input'));
    await user.tab();
    expect(await screen.findByTestId('presupuesto_validation_message')).toHaveTextContent('mayor que 0');
  });

  test('a valid budget never shows the budget message, even after blur', async () => {
    renderStep();
    const user = setupUser();
    await user.click(screen.getByTestId('presupuesto_input'));
    await user.tab();
    expect(screen.queryByTestId('presupuesto_validation_message')).toBeNull();
  });

  test('shows the planning message only when the parent says the selection is empty', () => {
    const { unmount } = renderStep();
    expect(screen.queryByTestId('planning_validation_message')).toBeNull();
    unmount();
    renderStep({ hasInvalidPlanning: true });
    expect(screen.getByTestId('planning_validation_message')).toHaveTextContent('al menos un día y una comida');
  });

  test('renders the planning grid', () => {
    renderStep();
    expect(screen.getByTestId('planning_selection_grid')).toBeInTheDocument();
  });
});
