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

  test('shows every goal and level as a visible radio card', () => {
    renderStep();
    expect(screen.getByRole('radiogroup', { name: 'Objetivo' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: /Perder peso|Comer sano|Ahorrar dinero|Ganar masa muscular|Comer más variado|Reducir desperdicio/ })).toHaveLength(6);
    expect(screen.getByRole('radiogroup', { name: 'Nivel de experiencia culinaria' })).toBeInTheDocument();
    expect(screen.getByText(/Estoy empezando/)).toBeInTheDocument();
  });

  test('choosing a goal writes it to the store', async () => {
    renderStep();
    await setupUser().click(screen.getByTestId('objetivo_group_option_comer_sano'));
    expect(useOnboardingStore.getState().objetivo).toBe('comer_sano');
    expect(screen.getByTestId('objetivo_group_option_comer_sano')).toBeChecked();
  });

  test('choosing a cooking level writes it to the store', async () => {
    renderStep();
    await setupUser().click(screen.getByTestId('nivel_experiencia_group_option_novato'));
    expect(useOnboardingStore.getState().nivelExperiencia).toBe('novato');
  });

  test('arrow keys move the goal selection', async () => {
    const user = setupUser();
    renderStep();
    await user.click(screen.getByTestId('objetivo_group_option_perder_peso'));
    await user.keyboard('{ArrowRight}');
    expect(useOnboardingStore.getState().objetivo).toBe('comer_sano');
  });

  test('says what each goal does to the menu, and labels the two goals with no data behind them', () => {
    renderStep();
    expect(screen.getByTestId('objetivo_effect_hint')).toHaveTextContent('Con Pro');
    for (const goal of ['perder_peso', 'ganar_masa_muscular']) {
      expect(screen.getByTestId(`objetivo_group_option_${goal}`)).toHaveTextContent('Próximamente: aún no cambia tu menú.');
    }
    expect(screen.getByText(/orientativo, no un cálculo nutricional/)).toBeInTheDocument();
    expect(screen.getByTestId('nivel_effect_hint')).toHaveTextContent('aprendiz o novato');
  });
});
