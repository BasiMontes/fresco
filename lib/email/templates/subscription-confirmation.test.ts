import { describe, expect, test } from 'bun:test';
import { CONTACT_EMAIL, LEGAL_ENTITY } from '@/components/legal/legal-modal';
import { renderSubscriptionConfirmationEmailHtml } from './subscription-confirmation';

/**
 * FRESCO-429 (TRLGDCU art. 98.7) — pins the five mandatory content points
 * from the Jira AC onto the rendered HTML. Visual/brand fidelity (fonts,
 * layout) is a manual check, same as the other email templates in this repo.
 */
describe('renderSubscriptionConfirmationEmailHtml', () => {
  const html = renderSubscriptionConfirmationEmailHtml({
    priceFormatted: '4,99 €',
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
      nextRenewalDateFormatted: '7 de octubre de 2026',
      manageSubscriptionUrl: 'https://fresco-pro.vercel.app/profile',
    });
    expect(unsafe).not.toContain('<script>alert(1)</script>');
  });
});
