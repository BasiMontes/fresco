import type { ProPriceInfo } from '@/lib/legal/pro-summary';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { UpgradeToProButton } from './upgrade-to-pro-button';

/**
 * FRESCO-794 (ADR-0040) — the Pro CTA no longer jumps straight to Stripe: it opens
 * the pre-contract summary, and only after the withdrawal waiver is ticked,
 * recorded and the checkout session created does it redirect. Only `fetch` is
 * stubbed (`/api/stripe/pro-price`, `/api/consents`, `/api/stripe/checkout`).
 */

const realFetch = globalThis.fetch;

const PRICE: ProPriceInfo = { amount: 4.99, currency: 'eur', interval: 'month', intervalCount: 1, taxIncluded: false, trialDays: 7 };

const ANNUAL: ProPriceInfo = { amount: 44.99, currency: 'eur', interval: 'year', intervalCount: 1, taxIncluded: false, trialDays: 7 };

let price: ProPriceInfo = PRICE;
let annualPrice: ProPriceInfo | null = null;
let priceStatus = 200;
let consentStatus = 200;
let calls: Array<{ url: string, body: unknown }> = [];

beforeEach(() => {
  price = PRICE;
  annualPrice = null;
  priceStatus = 200;
  consentStatus = 200;
  calls = [];
  window.location.hash = '';
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
    if (url === '/api/stripe/pro-price') {
      return new Response(JSON.stringify(price), { status: priceStatus });
    }
    if (url === '/api/stripe/pro-price?interval=year') {
      return annualPrice ? new Response(JSON.stringify(annualPrice), { status: 200 }) : new Response(null, { status: 500 });
    }
    if (url === '/api/consents') {
      return new Response(null, { status: consentStatus });
    }
    if (url === '/api/stripe/checkout') {
      return new Response(JSON.stringify({ url: '#stripe-checkout' }), { status: 200 });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const urls = () => calls.map(c => c.url);

async function openSummary() {
  const user = setupUser();
  renderWithProviders(<UpgradeToProButton />);
  await user.click(screen.getByTestId('upgrade_to_pro_button'));
  await waitFor(() => expect(screen.getByTestId('pro_checkout_trial')).toBeTruthy());
  return user;
}

describe('UpgradeToProButton label (FRESCO-822)', () => {
  test.each([
    ['a user who still has the trial', true, 'Empezar prueba gratis'],
    ['a user who already used it', false, 'Volver a Pro'],
    ['an unknown state: no trial is promised', undefined, 'Pásate a Pro'],
  ])('%s', (_label, trialAvailable, expected) => {
    renderWithProviders(<UpgradeToProButton trialAvailable={trialAvailable} />);

    expect(screen.getByTestId('upgrade_to_pro_button').textContent).toBe(expected);
  });

  test('an explicit label wins (the sidebar passes "Mejorar plan")', () => {
    renderWithProviders(<UpgradeToProButton label="Mejorar plan" trialAvailable={false} />);

    expect(screen.getByTestId('upgrade_to_pro_button').textContent).toBe('Mejorar plan');
  });
});

describe('UpgradeToProButton + pre-contract summary', () => {
  test('clicking the CTA opens the summary and does not start the checkout', async () => {
    await openSummary();

    expect(screen.getByTestId('pro_checkout_dialog')).toBeTruthy();
    expect(urls().filter(u => u === '/api/stripe/checkout')).toEqual([]);
  });

  test('the price comes from Stripe and never claims the tax is included unless Stripe says so', async () => {
    await openSummary();
    const text = screen.getByTestId('pro_checkout_price').textContent?.replaceAll(/\s/g, ' ');

    expect(text).toContain('4,99 € al mes');
    expect(text).not.toContain('IVA');
  });

  test('says "IVA incluido" when the price is tax-inclusive', async () => {
    price = { ...PRICE, taxIncluded: true };
    await openSummary();

    expect(screen.getByTestId('pro_checkout_price').textContent).toContain('IVA incluido');
  });

  test('a user with the trial available is told about it', async () => {
    await openSummary();
    expect(screen.getByTestId('pro_checkout_trial').textContent).toContain('7 días de prueba gratis, sin tarjeta');
  });

  test('a used trial is stated plainly', async () => {
    price = { ...PRICE, trialDays: null };
    await openSummary();

    expect(screen.getByTestId('pro_checkout_trial').textContent).toContain('Ya usaste tu prueba gratuita');
  });

  test('names the provider and a contact, with the sentences properly separated', async () => {
    await openSummary();

    const provider = screen.getByTestId('pro_checkout_provider').textContent ?? '';
    expect(provider).toContain('notificaciones. Contacto: hola.frescoapp@gmail.com.');
  });

  test('"Continuar al pago" stays disabled until the withdrawal waiver is ticked', async () => {
    const user = await openSummary();
    const confirm = screen.getByTestId<HTMLButtonElement>('pro_checkout_confirm_button');

    expect(screen.getByTestId<HTMLInputElement>('pro_checkout_withdrawal_checkbox').checked).toBe(false);
    expect(confirm.disabled).toBe(true);

    await user.click(screen.getByTestId('pro_checkout_withdrawal_checkbox'));
    expect(confirm.disabled).toBe(false);
  });

  test('confirming records the waiver first, then creates the checkout and redirects', async () => {
    const user = await openSummary();
    await user.click(screen.getByTestId('pro_checkout_withdrawal_checkbox'));

    await user.click(screen.getByTestId('pro_checkout_confirm_button'));

    await waitFor(() => expect(window.location.hash).toBe('#stripe-checkout'));
    expect(urls().filter(u => !u.startsWith('/api/stripe/pro-price'))).toEqual(['/api/consents', '/api/stripe/checkout']);
    expect(calls.find(c => c.url === '/api/consents')?.body).toEqual({ kinds: ['withdrawal_waiver'] });
    expect(calls.find(c => c.url === '/api/stripe/checkout')?.body).toEqual({ interval: 'month' });
  });

  test('if the waiver cannot be recorded, nothing is charged: no checkout, an error, and the box stays usable', async () => {
    consentStatus = 500;
    const user = await openSummary();
    await user.click(screen.getByTestId('pro_checkout_withdrawal_checkbox'));

    await user.click(screen.getByTestId('pro_checkout_confirm_button'));

    await waitFor(() => expect(screen.getByTestId('upgrade_to_pro_error_message')).toBeTruthy());
    expect(urls()).not.toContain('/api/stripe/checkout');
    expect(window.location.hash).toBe('');
    expect(screen.getByTestId<HTMLButtonElement>('pro_checkout_confirm_button').disabled).toBe(false);
  });

  test('if the price cannot be loaded, the user cannot confirm', async () => {
    priceStatus = 500;
    const user = setupUser();
    renderWithProviders(<UpgradeToProButton />);
    await user.click(screen.getByTestId('upgrade_to_pro_button'));
    await waitFor(() => expect(screen.getByTestId('pro_checkout_price').textContent).toContain('No se pudo cargar el precio'));
    await user.click(screen.getByTestId('pro_checkout_withdrawal_checkbox'));

    expect(screen.getByTestId<HTMLButtonElement>('pro_checkout_confirm_button').disabled).toBe(true);
  });

  test('cancelling closes the summary without recording or charging anything', async () => {
    const user = await openSummary();

    await user.click(screen.getByTestId('pro_checkout_cancel_button'));

    expect(urls().filter(u => !u.startsWith('/api/stripe/pro-price'))).toEqual([]);
  });
});

describe('UpgradeToProButton + annual plan (FRESCO-844)', () => {
  test('without an annual price there is no selector and the dialog stays monthly', async () => {
    await openSummary();

    expect(screen.queryByRole('radiogroup', { name: 'Plan de facturación' })).toBeNull();
    expect(screen.getByTestId('pro_checkout_dialog').textContent).toContain('cada mes');
  });

  test('with an annual price the selector appears, defaulting to monthly', async () => {
    annualPrice = ANNUAL;
    await openSummary();

    await waitFor(() => expect(screen.getByRole('radiogroup', { name: 'Plan de facturación' })).toBeTruthy());
    expect(screen.getByRole('radio', { name: 'Mensual' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('pro_checkout_price').textContent?.replaceAll(/\s/g, ' ')).toContain('4,99 € al mes');
  });

  test('picking Anual shows the Stripe annual price, the saving against 12 months and the yearly renewal', async () => {
    annualPrice = ANNUAL;
    const user = await openSummary();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Anual' })).toBeTruthy());

    await user.click(screen.getByRole('radio', { name: 'Anual' }));

    const price = screen.getByTestId('pro_checkout_price').textContent?.replaceAll(/\s/g, ' ') ?? '';
    expect(price).toContain('44,99 € por año');
    expect(price).toContain('Ahorras 14,89 € al año');
    expect(screen.getByTestId('pro_checkout_dialog').textContent).toContain('cada año');
  });

  test('confirming with Anual asks the checkout for the yearly plan', async () => {
    annualPrice = ANNUAL;
    const user = await openSummary();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Anual' })).toBeTruthy());
    await user.click(screen.getByRole('radio', { name: 'Anual' }));
    await user.click(screen.getByTestId('pro_checkout_withdrawal_checkbox'));

    await user.click(screen.getByTestId('pro_checkout_confirm_button'));

    await waitFor(() => expect(window.location.hash).toBe('#stripe-checkout'));
    expect(calls.find(c => c.url === '/api/stripe/checkout')?.body).toEqual({ interval: 'year' });
  });
});
