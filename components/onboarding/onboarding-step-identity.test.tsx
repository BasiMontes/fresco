import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRef } from 'react';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { fireEvent, renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { OnboardingStepIdentity } from './onboarding-step-identity';

// FRESCO-1078 — wizard step 1: everything is optional and goes straight into the shared store.

beforeEach(() => { useOnboardingStore.getState().reset(); });
afterEach(() => { useOnboardingStore.getState().reset(); });

const renderStep = () => renderWithProviders(<OnboardingStepIdentity headingRef={createRef<HTMLHeadingElement>()} />);

describe('OnboardingStepIdentity', () => {
  test('shows the heading and says everything is optional', () => {
    renderStep();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cuéntanos sobre ti');
    expect(screen.getByText(/Todo es opcional/)).toBeInTheDocument();
  });

  test('shows the stored name', () => {
    useOnboardingStore.getState().setNombre('Laura');
    renderStep();
    expect(screen.getByTestId('nombre_input')).toHaveValue('Laura');
  });

  test('typing the name writes it to the store', () => {
    renderStep();
    fireEvent.change(screen.getByTestId('nombre_input'), { target: { value: 'Marta' } });
    expect(useOnboardingStore.getState().nombre).toBe('Marta');
  });

  test('choosing a goal writes it to the store', async () => {
    renderStep();
    const user = setupUser();
    await user.click(screen.getByTestId('objetivo_dropdown'));
    await user.click(await screen.findByText('Comer sano'));
    expect(useOnboardingStore.getState().objetivo).toBe('comer_sano');
  });

  test('choosing a cooking level writes it to the store', async () => {
    renderStep();
    const user = setupUser();
    await user.click(screen.getByTestId('nivel_experiencia_dropdown'));
    const options = await screen.findAllByRole('option');
    await user.click(options[0]);
    expect(useOnboardingStore.getState().nivelExperiencia).not.toBeNull();
  });
});
