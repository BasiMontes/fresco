import type { EndpointInfo, PortalConfigInfo, PriceInfo } from './check-stripe-go-live';
import { describe, expect, test } from 'bun:test';
import { HANDLED_EVENT_TYPES } from '../lib/billing/handled-events';
import { auditNames, auditPortal, auditPrice, auditWebhookEndpoint, exitCode, manualChecks, parseJsonOutput } from './check-stripe-go-live';

/**
 * FRESCO-1004 (audit 7b A7-PAY-08, A7-LAUNCH-04) — the read-only go-live check exits non-zero for
 * every missing item of the checklist and never for a present one.
 */

const HOST = 'fresco-pro.vercel.app';
const endpoint = (over: Partial<EndpointInfo> = {}): EndpointInfo => ({ id: 'we_1', url: `https://${HOST}/api/stripe/webhook`, status: 'enabled', enabled_events: [...HANDLED_EVENT_TYPES], ...over });
const statuses = (checks: { status: string }[]) => checks.map(check => check.status);

describe('auditWebhookEndpoint', () => {
  test('passes when the production endpoint is enabled and subscribed to every handled event', () => {
    expect(statuses(auditWebhookEndpoint([endpoint()], HOST, HANDLED_EVENT_TYPES))).toEqual(['pass']);
  });

  test('fails when there is no endpoint for the production host', () => {
    const other = endpoint({ url: 'https://fresco-pre.vercel.app/api/stripe/webhook' });

    expect(auditWebhookEndpoint([other], HOST, HANDLED_EVENT_TYPES)[0]).toMatchObject({ status: 'fail', detail: expect.stringContaining(HOST) });
  });

  test('ignores a disabled endpoint', () => {
    expect(statuses(auditWebhookEndpoint([endpoint({ status: 'disabled' })], HOST, HANDLED_EVENT_TYPES))).toEqual(['fail']);
  });

  test.each([...HANDLED_EVENT_TYPES])('fails and names %s when the endpoint is not subscribed to it', (event) => {
    const events = [...HANDLED_EVENT_TYPES].filter(candidate => candidate !== event);

    expect(auditWebhookEndpoint([endpoint({ enabled_events: events })], HOST, HANDLED_EVENT_TYPES)[0]).toMatchObject({ status: 'fail', detail: expect.stringContaining(event) });
  });

  test('a wildcard subscription covers every event', () => {
    expect(statuses(auditWebhookEndpoint([endpoint({ enabled_events: ['*'] })], HOST, HANDLED_EVENT_TYPES))).toEqual(['pass']);
  });

  test('the handled list carries the dispute and the delayed-payment grant', () => {
    expect(HANDLED_EVENT_TYPES.has('charge.dispute.created')).toBe(true);
    expect(HANDLED_EVENT_TYPES.has('checkout.session.async_payment_succeeded')).toBe(true);
  });
});

describe('auditPortal', () => {
  const config = (over: Partial<PortalConfigInfo> = {}, features: PortalConfigInfo['features'] = {}): PortalConfigInfo => ({
    id: 'bpc_1',
    active: true,
    is_default: true,
    features: { subscription_cancel: { enabled: true }, payment_method_update: { enabled: true }, invoice_history: { enabled: true }, ...features },
    ...over,
  });

  test('passes when the default configuration lets a customer cancel and change the card', () => {
    expect(statuses(auditPortal([config()]))).toEqual(['pass', 'pass', 'pass']);
  });

  test('fails when there is no active default configuration', () => {
    expect(statuses(auditPortal([]))).toEqual(['fail']);
    expect(statuses(auditPortal([config({ is_default: false })]))).toEqual(['fail']);
    expect(statuses(auditPortal([config({ active: false })]))).toEqual(['fail']);
  });

  test('fails when customers cannot cancel: nobody could cancel on the first day', () => {
    const checks = auditPortal([config({}, { subscription_cancel: { enabled: false } })]);

    expect(checks.find(check => check.id === 'portal-subscription_cancel')?.status).toBe('fail');
  });

  test('fails when customers cannot change the card', () => {
    expect(auditPortal([config({}, { payment_method_update: { enabled: false } })]).find(check => check.id === 'portal-payment_method_update')?.status).toBe('fail');
  });

  test('only warns about invoice history', () => {
    const checks = auditPortal([config({}, { invoice_history: { enabled: false } })]);

    expect(checks.find(check => check.id === 'portal-invoice_history')?.status).toBe('warn');
    expect(exitCode(checks)).toBe(0);
  });
});

describe('auditPrice', () => {
  const price = (over: Partial<PriceInfo> = {}): PriceInfo => ({ active: true, currency: 'eur', unit_amount: 499, recurring: { interval: 'month', interval_count: 1 }, tax_behavior: 'inclusive', ...over });

  test('passes a fixed recurring euro price whose tax behavior is decided', () => {
    expect(auditPrice('month', 'price_m', price(), 'month', { required: true }).status).toBe('pass');
    expect(auditPrice('month', 'price_m', price({ tax_behavior: 'exclusive' }), 'month', { required: true }).status).toBe('pass');
  });

  test('fails when tax_behavior is unspecified: "IVA incluido" would be neither true nor false', () => {
    expect(auditPrice('month', 'price_m', price({ tax_behavior: 'unspecified' }), 'month', { required: true })).toMatchObject({ status: 'fail', detail: expect.stringContaining('tax_behavior') });
    expect(auditPrice('month', 'price_m', price({ tax_behavior: null }), 'month', { required: true }).status).toBe('fail');
  });

  test.each([
    ['inactive', { active: false }],
    ['not in euros', { currency: 'usd' }],
    ['not recurring', { recurring: null }],
    ['without an amount', { unit_amount: null }],
    ['billed yearly when monthly is expected', { recurring: { interval: 'year', interval_count: 1 } }],
    ['billed every two months', { recurring: { interval: 'month', interval_count: 2 } }],
  ] as [string, Partial<PriceInfo>][])('fails a price that is %s', (_label, over) => {
    expect(auditPrice('month', 'price_m', price(over), 'month', { required: true }).status).toBe('fail');
  });

  test('fails when the price cannot be read, or the required id is missing', () => {
    expect(auditPrice('month', 'price_m', null, 'month', { required: true }).status).toBe('fail');
    expect(auditPrice('month', undefined, null, 'month', { required: true }).status).toBe('fail');
  });

  test('a missing annual id only warns: the annual plan stays hidden', () => {
    expect(auditPrice('year', undefined, null, 'year', { required: false }).status).toBe('warn');
  });
});

describe('auditNames', () => {
  const need = { required: ['A', 'B'], anyOf: [['C', 'D']] };

  test('passes when every required name and one of each group is set', () => {
    expect(statuses(auditNames('s', new Set(['A', 'B', 'D']), need))).toEqual(['pass', 'pass']);
  });

  test('fails naming what is missing', () => {
    expect(auditNames('s', new Set(['A', 'C']), need)[0]).toMatchObject({ status: 'fail', detail: expect.stringContaining('B') });
  });

  test('fails when no name of an any-of group is set', () => {
    expect(auditNames('s', new Set(['A', 'B']), need)[1]).toMatchObject({ status: 'fail', detail: expect.stringContaining('C / D') });
  });
});

describe('manualChecks and exitCode', () => {
  test('dunning blocks until the owner acknowledges it', () => {
    expect(manualChecks(new Set())[0].status).toBe('manual');
    expect(exitCode(manualChecks(new Set()))).toBe(1);
    expect(manualChecks(new Set(['dunning']))[0].status).toBe('pass');
    expect(exitCode(manualChecks(new Set(['dunning'])))).toBe(0);
  });

  test('any single failure exits non-zero, warnings never do', () => {
    expect(exitCode([{ id: 'a', status: 'pass', detail: '' }, { id: 'b', status: 'fail', detail: '' }])).toBe(1);
    expect(exitCode([{ id: 'a', status: 'pass', detail: '' }, { id: 'b', status: 'warn', detail: '' }])).toBe(0);
  });
});

describe('parseJsonOutput', () => {
  test('skips a banner line before the JSON', () => {
    expect(parseJsonOutput('Vercel CLI 57.0.0\n{"envs":[{"key":"A"}]}')).toEqual({ envs: [{ key: 'A' }] });
    expect(parseJsonOutput('[{"name":"A"}]')).toEqual([{ name: 'A' }]);
  });

  test('is null when there is no JSON', () => {
    expect(parseJsonOutput('not logged in')).toBeNull();
  });
});
