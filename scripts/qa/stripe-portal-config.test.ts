import type { PortalConfigurationShape } from './stripe-portal-config';
import { describe, expect, test } from 'bun:test';
import { evaluatePortal, keyMode } from './stripe-portal-config';

/**
 * FRESCO-1289: the two Billing Portal scenarios live in Stripe's hosted UI, so what can break is the portal
 * configuration. These tests pin the rule that `scripts/qa/stripe-portal-config.ts` applies to it.
 */

function configuration(overrides: Partial<PortalConfigurationShape> = {}): PortalConfigurationShape {
  return {
    id: 'bpc_default',
    is_default: true,
    active: true,
    features: {
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      invoice_history: { enabled: true },
    },
    ...overrides,
  };
}

const outcome = (configurations: PortalConfigurationShape[]) => evaluatePortal(configurations).map(check => `${check.id}:${check.ok}`);

describe('evaluatePortal', () => {
  test('a default configuration that cancels at period end and shows invoices passes every check', () => {
    expect(outcome([configuration()])).toEqual(['default-configuration:true', 'cancel-at-period-end:true', 'invoice-history:true']);
  });

  test('a cancellation that takes effect immediately fails the cancel check only', () => {
    const immediate = configuration({ features: { subscription_cancel: { enabled: true, mode: 'immediately' }, invoice_history: { enabled: true } } });
    expect(outcome([immediate])).toEqual(['default-configuration:true', 'cancel-at-period-end:false', 'invoice-history:true']);
    expect(evaluatePortal([immediate])[1].detail).toContain('immediately');
  });

  test('cancelling switched off fails the cancel check, even when the mode is at_period_end', () => {
    const off = configuration({ features: { subscription_cancel: { enabled: false, mode: 'at_period_end' }, invoice_history: { enabled: true } } });
    expect(outcome([off])[1]).toBe('cancel-at-period-end:false');
  });

  test('an invoice history that is off or missing fails the invoice check', () => {
    expect(outcome([configuration({ features: { subscription_cancel: { enabled: true, mode: 'at_period_end' }, invoice_history: { enabled: false } } })])[2]).toBe('invoice-history:false');
    expect(outcome([configuration({ features: { subscription_cancel: { enabled: true, mode: 'at_period_end' } } })])[2]).toBe('invoice-history:false');
  });

  test('no default configuration, or an inactive one, fails all three because sessions use the default', () => {
    expect(outcome([])).toEqual(['default-configuration:false', 'cancel-at-period-end:false', 'invoice-history:false']);
    expect(outcome([configuration({ active: false })])).toEqual(['default-configuration:false', 'cancel-at-period-end:false', 'invoice-history:false']);
    expect(outcome([configuration({ is_default: false })])[0]).toBe('default-configuration:false');
  });

  test('judges the default configuration, not another one that happens to be fine', () => {
    const bad = configuration({ id: 'bpc_default', features: { subscription_cancel: { enabled: true, mode: 'immediately' }, invoice_history: { enabled: true } } });
    const fine = configuration({ id: 'bpc_other', is_default: false });
    expect(outcome([fine, bad])[1]).toBe('cancel-at-period-end:false');
  });
});

describe('keyMode', () => {
  test('reads test or live from the prefix and never returns the key', () => {
    expect(keyMode('sk_live_abc')).toBe('live');
    expect(keyMode('rk_live_abc')).toBe('live');
    expect(keyMode('sk_test_abc')).toBe('test');
    expect(keyMode('something-else')).toBe('test');
  });
});
