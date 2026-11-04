import { describe, expect, test } from 'bun:test';
import { evaluateAuthSettings, EXPECTED_TRUE, MIN_PASSWORD_LENGTH, readProductionProjectRef } from './check-hosted-auth-settings';

/** What the hosted project answers today, trimmed to the keys the check reads. */
const EVALUATE_CLEAN_FIXTURE: Record<string, unknown> = {
  security_update_password_require_current_password: true,
  security_update_password_require_reauthentication: true,
  mailer_secure_email_change_enabled: true,
  security_captcha_enabled: true,
  password_min_length: 10,
};

describe('evaluateAuthSettings (FRESCO-1090, A8-AUTHZ-04)', () => {
  test('a project with every expected setting on is clean', () => {
    expect(evaluateAuthSettings({ ...EVALUATE_CLEAN_FIXTURE })).toEqual([]);
  });

  test.each(EXPECTED_TRUE.map(e => e.key))('%s turned off is a finding that names it', (key) => {
    const findings = evaluateAuthSettings({ ...EVALUATE_CLEAN_FIXTURE, [key]: false });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain(key);
    expect(findings[0]).toContain('is false');
  });

  test.each(EXPECTED_TRUE.map(e => e.key))('%s missing from the response fails closed', (key) => {
    const { [key]: _removed, ...rest } = EVALUATE_CLEAN_FIXTURE;
    const findings = evaluateAuthSettings(rest);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('cannot be verified');
  });

  test('a setting returned as null or a string is not read as true', () => {
    const [first, second] = EXPECTED_TRUE;
    const findings = evaluateAuthSettings({ ...EVALUATE_CLEAN_FIXTURE, [first.key]: null, [second.key]: 'true' });
    expect(findings).toHaveLength(2);
    expect(findings.every(f => f.includes('cannot be verified'))).toBe(true);
  });

  test('a minimum password length below the policy is a finding', () => {
    const findings = evaluateAuthSettings({ ...EVALUATE_CLEAN_FIXTURE, password_min_length: MIN_PASSWORD_LENGTH - 1 });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('password_min_length');
  });

  test('a longer minimum is fine, a missing one fails closed', () => {
    expect(evaluateAuthSettings({ ...EVALUATE_CLEAN_FIXTURE, password_min_length: 12 })).toEqual([]);
    const { password_min_length: _removed, ...rest } = EVALUATE_CLEAN_FIXTURE;
    expect(evaluateAuthSettings(rest)).toHaveLength(1);
  });

  test('several drifts are all reported, one line each', () => {
    const findings = evaluateAuthSettings({
      ...EVALUATE_CLEAN_FIXTURE,
      security_captcha_enabled: false,
      security_update_password_require_current_password: false,
      password_min_length: 6,
    });
    expect(findings).toHaveLength(3);
  });
});

describe('readProductionProjectRef', () => {
  test('reads the production ref from project.yaml', () => {
    const yaml = 'environments:\n  production:\n    db_project_ref: abcdefghijklmnop\n';
    expect(readProductionProjectRef(yaml)).toBe('abcdefghijklmnop');
  });

  test('throws when the ref is missing, so the check cannot silently target nothing', () => {
    expect(() => readProductionProjectRef('environments:\n  production: {}\n')).toThrow('db_project_ref');
    expect(() => readProductionProjectRef('project:\n  project_name: x\n')).toThrow('db_project_ref');
  });
});
