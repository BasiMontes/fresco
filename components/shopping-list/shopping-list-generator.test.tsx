import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as edgeFunctions from '@/lib/api/edge-functions';
import * as authApi from '@/lib/client-api/auth';
import * as events from '@/lib/posthog/events';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { ShoppingListGenerator } from './shopping-list-generator';

// FRESCO-1077 — generating the list: automatically on the first visit, by hand
// after a failure, and what each failure tells the user. A 409 is not a failure:
// another generation already made the list, so the page just re-reads it.

const { EdgeFunctionError } = edgeFunctions;
const RESULT = { resumen: { total_items: 12, coste_estimado_min: 20, coste_estimado_max: 30 } };

let generateSpy: ReturnType<typeof spyOn<typeof edgeFunctions, 'generateShoppingList'>>;
let tokenSpy: ReturnType<typeof spyOn<typeof authApi, 'getAccessToken'>>;
let captureSpy: ReturnType<typeof spyOn<typeof events, 'captureEvent'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  routerMock.refresh.mockClear();
  generateSpy = spyOn(edgeFunctions, 'generateShoppingList').mockResolvedValue(RESULT as never);
  tokenSpy = spyOn(authApi, 'getAccessToken').mockResolvedValue('tok');
  captureSpy = spyOn(events, 'captureEvent').mockImplementation(() => {});
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [generateSpy, tokenSpy, captureSpy, errorSpy]) { spy.mockRestore(); }
});

const button = () => screen.getByTestId('generate_shopping_list_button');

describe('ShoppingListGenerator manual mode', () => {
  test('offers the button and generates nothing until it is pressed', () => {
    renderWithProviders(<ShoppingListGenerator mealPlanId="plan1" />);
    expect(screen.getByText('Todavía no tienes una lista de la compra para este menú')).toBeInTheDocument();
    expect(generateSpy).not.toHaveBeenCalled();
  });

  test('pressing it generates for the plan, records the manual success and refreshes the page', async () => {
    renderWithProviders(<ShoppingListGenerator mealPlanId="plan1" />);
    await setupUser().click(button());
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(generateSpy).toHaveBeenCalledWith({ meal_plan_id: 'plan1' }, 'tok');
    expect(captureSpy).toHaveBeenCalledWith(expect.anything(), { auto: false, n_items: 12, coste_estimado_min: 20, coste_estimado_max: 30 });
  });

  test('shows the preparing state while the request is in flight', async () => {
    generateSpy.mockImplementation(async () => new Promise(() => {}));
    renderWithProviders(<ShoppingListGenerator mealPlanId="plan1" />);
    await setupUser().click(button());
    expect(await screen.findByText('Preparando tu lista de la compra')).toBeInTheDocument();
  });

  test('a 422 says the menu cannot be turned into a list, and the button stays', async () => {
    generateSpy.mockRejectedValue(new EdgeFunctionError(422, { error: 'no consolidable' }));
    renderWithProviders(<ShoppingListGenerator mealPlanId="plan1" />);
    await setupUser().click(button());
    expect(await screen.findByTestId('shopping_list_generate_error_message')).toHaveTextContent('No pudimos generar una lista de la compra a partir de este menú.');
    expect(button()).toBeEnabled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  test('any other failure asks to try again', async () => {
    generateSpy.mockRejectedValue(new Error('network'));
    renderWithProviders(<ShoppingListGenerator mealPlanId="plan1" />);
    await setupUser().click(button());
    expect(await screen.findByTestId('shopping_list_generate_error_message')).toHaveTextContent('Intenta de nuevo.');
  });

  test('a 409 means the list already exists: it re-reads the page and shows no error', async () => {
    generateSpy.mockRejectedValue(new EdgeFunctionError(409, { error: 'ya existe' }));
    renderWithProviders(<ShoppingListGenerator mealPlanId="plan1" />);
    await setupUser().click(button());
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('shopping_list_generate_error_message')).toBeNull();
    expect(captureSpy).not.toHaveBeenCalled();
  });
});

describe('ShoppingListGenerator automatic mode', () => {
  test('generates once on mount, records it as automatic and refreshes', async () => {
    renderWithProviders(<ShoppingListGenerator mealPlanId="plan1" autoGenerate />);
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ auto: true }));
  });

  test('when the automatic attempt fails it drops to the manual button and does not retry by itself', async () => {
    generateSpy.mockRejectedValue(new Error('network'));
    renderWithProviders(<ShoppingListGenerator mealPlanId="plan1" autoGenerate />);
    expect(await screen.findByText('No pudimos preparar tu lista automáticamente')).toBeInTheDocument();
    expect(generateSpy).toHaveBeenCalledTimes(1);
  });
});
