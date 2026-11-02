import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { OnboardingGenerateStatus } from './onboarding-generate-status';

// FRESCO-1078 — what the summary step says while and after generating: an error (as an alert,
// or as a calm note when a menu already exists), the success line, or a progress hint.

const base = { step: 4, generateError: null, generateSuccess: false, isGenerating: false, hasExistingMenu: false };

describe('OnboardingGenerateStatus', () => {
  test('says nothing by default', () => {
    const { container } = renderWithProviders(<OnboardingGenerateStatus {...base} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('an error on the summary step shows as an alert', () => {
    renderWithProviders(<OnboardingGenerateStatus {...base} generateError="No pudimos generar tu menú" />);
    const message = screen.getByTestId('generate_error_message');
    expect(message).toHaveTextContent('No pudimos generar tu menú');
    expect(message).toHaveAttribute('role', 'alert');
  });

  test('an error on any other step is not shown', () => {
    renderWithProviders(<OnboardingGenerateStatus {...base} step={2} generateError="No pudimos generar tu menú" />);
    expect(screen.queryByTestId('generate_error_message')).toBeNull();
  });

  test('when a menu already exists the same text is only informational', () => {
    renderWithProviders(<OnboardingGenerateStatus {...base} hasExistingMenu generateError="Ya tienes un menú esta semana" />);
    const message = screen.getByTestId('generate_error_message');
    expect(message).toHaveTextContent('Ya tienes un menú esta semana');
    expect(message).toHaveAttribute('role', 'status');
  });

  test('success shows the confirmation and hides the progress hint', () => {
    renderWithProviders(<OnboardingGenerateStatus {...base} generateSuccess isGenerating />);
    expect(screen.getByTestId('generate_success_message')).toHaveTextContent('Se ha generado tu menú correctamente');
    expect(screen.queryByTestId('generating_hint')).toBeNull();
  });

  test('while generating it shows the progress hint', () => {
    renderWithProviders(<OnboardingGenerateStatus {...base} isGenerating />);
    expect(screen.getByTestId('generating_hint')).toHaveTextContent('Preparando tu menú…');
  });
});
