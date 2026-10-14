import { describe, expect, test } from 'bun:test';
import { trialEmailSignals } from './trial-email-signals';

describe('trialEmailSignals', () => {
  test('a plain address on a public provider keeps the domain and is not an alias', () => {
    expect(trialEmailSignals('ana@gmail.com')).toEqual({ email_domain: 'gmail.com', email_plus_alias: false });
  });

  test('a plus alias is flagged', () => {
    expect(trialEmailSignals('ana+trial7@gmail.com')).toEqual({ email_domain: 'gmail.com', email_plus_alias: true });
  });

  test('the domain is lowercased before the provider check', () => {
    expect(trialEmailSignals('Ana@GMAIL.com')?.email_domain).toBe('gmail.com');
  });

  test('a company or unknown domain is reported as "other", never as itself', () => {
    expect(trialEmailSignals('ana@acme-corp.es')).toEqual({ email_domain: 'other', email_plus_alias: false });
    expect(trialEmailSignals('ana+x@acme-corp.es')).toEqual({ email_domain: 'other', email_plus_alias: true });
  });

  test('a missing or malformed address yields no signals', () => {
    expect(trialEmailSignals(null)).toBeNull();
    expect(trialEmailSignals(undefined)).toBeNull();
    expect(trialEmailSignals('')).toBeNull();
    expect(trialEmailSignals('no-at-sign')).toBeNull();
    expect(trialEmailSignals('@gmail.com')).toBeNull();
    expect(trialEmailSignals('ana@')).toBeNull();
  });
});
