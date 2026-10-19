import { describe, expect, test } from 'bun:test';
import { CONTACT_EMAIL, LEGAL_ENTITY } from '@/lib/legal/entity';
import { renderSubscriptionConfirmationEmailHtml } from './subscription-confirmation';

/**
 * FRESCO-429 (TRLGDCU art. 98.7) — pins the five mandatory content points
 * from the Jira AC onto the rendered HTML. Visual/brand fidelity (fonts,
 * layout) is a manual check, same as the other email templates in this repo.
 */
describe('renderSubscriptionConfirmationEmailHtml', () => {
  const html = renderSubscriptionConfirmationEmailHtml({
    priceFormatted: '4,99 €',
    interval: 'month',
    nextRenewalDateFormatted: '7 de octubre de 2026',
    manageSubscriptionUrl: 'https://fresco-pro.vercel.app/profile',
  });

  test('includes the provider identity', () => {
    expect(html).toContain(LEGAL_ENTITY);
    expect(html).toContain(CONTACT_EMAIL);
  });

  test('includes the object and total price', () => {
    expect(html).toContain('Fresco Pro');
    expect(html).toContain('4,99 €');
  });

  test('includes automatic monthly renewal and the next charge date', () => {
    expect(html).toContain('renovación automática');
    expect(html).toContain('7 de octubre de 2026');
  });

  test('includes how to cancel, linking to the manage-subscription URL', () => {
    expect(html).toContain('cancelar');
    expect(html).toContain('https://fresco-pro.vercel.app/profile');
  });

  test('includes the immediate-execution / withdrawal-loss confirmation (art. 103.m)', () => {
    expect(html).toContain('derecho de desistimiento');
    expect(html).toContain('103');
  });

  test('escapes untrusted interpolated values', () => {
    const unsafe = renderSubscriptionConfirmationEmailHtml({
      priceFormatted: '<script>alert(1)</script>',
      interval: 'month',
      nextRenewalDateFormatted: '7 de octubre de 2026',
      manageSubscriptionUrl: 'https://fresco-pro.vercel.app/profile',
    });
    expect(unsafe).not.toContain('<script>alert(1)</script>');
  });
});

/**
 * FRESCO-1005 — the plan's period and the free trial have to be stated, not implied. Snapshots of
 * the VISIBLE text (head, styles, markup and the embedded logo stripped) so a wording change shows
 * in a diff without a base64 image in it.
 */
function visibleText(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

describe('renderSubscriptionConfirmationEmailHtml — plan and trial (FRESCO-1005)', () => {
  const base = { priceFormatted: '4,99 €', nextRenewalDateFormatted: '24 de octubre de 2026', manageSubscriptionUrl: 'https://fresco-pro.vercel.app/profile' };

  test('monthly plan', () => {
    expect(visibleText(renderSubscriptionConfirmationEmailHtml({ ...base, interval: 'month' }))).toMatchSnapshot();
  });

  test('annual plan says anual, never mensual', () => {
    const html = renderSubscriptionConfirmationEmailHtml({ ...base, priceFormatted: '49,99 €', interval: 'year' });

    expect(html).toContain('Suscripción anual');
    expect(html).not.toContain('Suscripción mensual');
    expect(visibleText(html)).toMatchSnapshot();
  });

  test('trial without card says nothing is charged today and when the first charge is', () => {
    const html = renderSubscriptionConfirmationEmailHtml({ ...base, interval: 'month', trialDays: 7 });

    expect(html).toContain('Importe cobrado hoy: <strong>0 €</strong>');
    expect(html).toContain('Primer cobro de <strong>4,99 €</strong> el <strong>24 de octubre de 2026</strong>');
    expect(html).not.toContain('Importe total cobrado');
    expect(visibleText(html)).toMatchSnapshot();
  });
});

// FRESCO-1004 (A7-LAUNCH-05): the email says "IVA incluido" only when Stripe declares the Price tax-inclusive.
describe('renderSubscriptionConfirmationEmailHtml — IVA incluido', () => {
  const base = { priceFormatted: '4,99 €', interval: 'month' as const, nextRenewalDateFormatted: '7 de octubre de 2026', manageSubscriptionUrl: 'https://fresco-pro.vercel.app/profile' };

  test('says it after the total when the Price is tax-inclusive, with and without a trial', () => {
    expect(renderSubscriptionConfirmationEmailHtml({ ...base, taxIncluded: true })).toContain('<strong>4,99 €</strong> (IVA incluido).');
    expect(renderSubscriptionConfirmationEmailHtml({ ...base, taxIncluded: true, trialDays: 7 })).toContain('(IVA incluido).');
  });

  test('claims nothing about tax otherwise, and the old hedge is gone', () => {
    for (const html of [renderSubscriptionConfirmationEmailHtml(base), renderSubscriptionConfirmationEmailHtml({ ...base, taxIncluded: false, trialDays: 7 })]) {
      expect(html).not.toContain('IVA incluido');
      expect(html).not.toContain('impuestos incluidos');
    }
  });
});
