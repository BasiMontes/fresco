import type { ExpectedAuthRelease } from './check-hosted-auth-settings';
import { describe, expect, test } from 'bun:test';
import { evaluateAuthSettings, EXPECTED_FALSE, EXPECTED_TRUE, MIN_PASSWORD_LENGTH, normalizeTemplate, readExpectedRelease, readProductionProjectRef, TEMPLATE_TYPES } from './check-hosted-auth-settings';

/** What the hosted project answers today, trimmed to the keys the check reads. */
const EVALUATE_CLEAN_FIXTURE: Record<string, unknown> = {
  security_update_password_require_current_password: true,
  security_update_password_require_reauthentication: true,
  mailer_secure_email_change_enabled: true,
  security_captcha_enabled: true,
  password_min_length: 10,
  // FRESCO-1188
  mailer_autoconfirm: false,
  rate_limit_email_sent: 30,
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

/**
 * FRESCO-1188 (integral review A3): the confirmation and recovery emails depend on more of the hosted project than
 * the first four toggles: autoconfirm must be off, `site_url` and the redirect allow-list must be the ones the links
 * need, and the live templates (pushed by hand through the Management API) must still be the repo copies.
 */
describe('evaluateAuthSettings — mail settings (FRESCO-1188)', () => {
  test.each(EXPECTED_FALSE.map(e => e.key))('%s turned on is a finding that names it', (key) => {
    const findings = evaluateAuthSettings({ ...EVALUATE_CLEAN_FIXTURE, [key]: true });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain(key);
    expect(findings[0]).toContain('is true, expected false');
  });

  test.each(EXPECTED_FALSE.map(e => e.key))('%s missing from the response fails closed', (key) => {
    const { [key]: _removed, ...rest } = EVALUATE_CLEAN_FIXTURE;

    const findings = evaluateAuthSettings(rest);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('cannot be verified');
  });

  test.each([undefined, null, 0, '30'])('rate_limit_email_sent returned as %p is not read as a limit', (value) => {
    const findings = evaluateAuthSettings({ ...EVALUATE_CLEAN_FIXTURE, rate_limit_email_sent: value });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('rate_limit_email_sent');
  });
});

const REPO_TEMPLATES = {
  confirmation: '<html>\n<body>\nConfirma tu correo\n</body>\n</html>\n',
  recovery: '<html>\n<body>\nRestablece tu contraseña\n</body>\n</html>\n',
  email_change: '<html>\n<body>\n{{ .Token }}\n</body>\n</html>\n',
};

const EXPECTED: ExpectedAuthRelease = {
  siteUrl: 'https://fresco-pro.vercel.app',
  origins: ['https://fresco-pro.vercel.app', 'https://fresco-pre.vercel.app'],
  templates: REPO_TEMPLATES,
};

const LIVE_CLEAN: Record<string, unknown> = {
  ...EVALUATE_CLEAN_FIXTURE,
  site_url: 'https://fresco-pro.vercel.app',
  uri_allow_list: 'https://fresco-pro.vercel.app/**,https://fresco-pre.vercel.app/**',
  mailer_templates_confirmation_content: REPO_TEMPLATES.confirmation,
  mailer_templates_recovery_content: REPO_TEMPLATES.recovery,
  mailer_templates_email_change_content: REPO_TEMPLATES.email_change,
};

describe('evaluateAuthSettings — site URL, redirects and live templates (FRESCO-1188)', () => {
  test('a project that matches the repo is clean', () => {
    expect(evaluateAuthSettings(LIVE_CLEAN, EXPECTED)).toEqual([]);
  });

  test('without an expected release only the always-on checks run', () => {
    expect(evaluateAuthSettings(EVALUATE_CLEAN_FIXTURE)).toEqual([]);
  });

  test('a wrong site_url is a finding that says what it should be; a trailing slash is not', () => {
    expect(evaluateAuthSettings({ ...LIVE_CLEAN, site_url: 'https://fresco-pro.vercel.app/' }, EXPECTED)).toEqual([]);

    const findings = evaluateAuthSettings({ ...LIVE_CLEAN, site_url: 'http://localhost:3000' }, EXPECTED);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('site_url');
    expect(findings[0]).toContain('https://fresco-pro.vercel.app');
  });

  test('a site_url that is not returned fails closed', () => {
    const { site_url: _removed, ...rest } = LIVE_CLEAN;

    const findings = evaluateAuthSettings(rest, EXPECTED);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('cannot be verified');
  });

  test('an allow-list that does not cover one of the origins is a finding naming the link', () => {
    const findings = evaluateAuthSettings({ ...LIVE_CLEAN, uri_allow_list: 'https://fresco-pro.vercel.app/**' }, EXPECTED);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('https://fresco-pre.vercel.app/auth/confirm?next=/onboarding');
  });

  test.each([
    ['an exact entry', 'https://fresco-pro.vercel.app/auth/confirm?next=/onboarding,https://fresco-pre.vercel.app/auth/confirm?next=/onboarding'],
    ['a path wildcard', 'https://fresco-pro.vercel.app/auth/**,https://fresco-pre.vercel.app/auth/**'],
    ['spaces around the entries', ' https://fresco-pro.vercel.app/** , https://fresco-pre.vercel.app/** '],
  ])('%s covers the links', (_name, allowList) => {
    expect(evaluateAuthSettings({ ...LIVE_CLEAN, uri_allow_list: allowList }, EXPECTED)).toEqual([]);
  });

  test('a bare wildcard is an open redirect and is a finding, even though it "covers" everything', () => {
    const findings = evaluateAuthSettings({ ...LIVE_CLEAN, uri_allow_list: '**' }, EXPECTED);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('bare wildcard');
  });

  test('a look-alike host does not cover an origin', () => {
    const findings = evaluateAuthSettings({ ...LIVE_CLEAN, uri_allow_list: 'https://fresco-pro.vercel.app.attacker.tld/**,https://fresco-pre.vercel.app/**' }, EXPECTED);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('https://fresco-pro.vercel.app/auth/confirm');
  });

  test('an allow-list that is not returned fails closed', () => {
    const { uri_allow_list: _removed, ...rest } = LIVE_CLEAN;

    expect(evaluateAuthSettings(rest, EXPECTED)).toHaveLength(1);
  });

  test.each(TEMPLATE_TYPES)('a live %s email that differs from the repo copy is a finding with the first differing line and no content', (type) => {
    const key = `mailer_templates_${type}_content`;

    const findings = evaluateAuthSettings({ ...LIVE_CLEAN, [key]: '<html>\n<body>\nOTRO TEXTO SECRETO\n</body>\n</html>' }, EXPECTED);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain(key);
    expect(findings[0]).toContain('first difference at line 3');
    expect(findings[0]).not.toContain('OTRO TEXTO SECRETO');
  });

  test.each(TEMPLATE_TYPES)('a live %s email that is not returned fails closed', (type) => {
    const key = `mailer_templates_${type}_content`;
    const { [key]: _removed, ...rest } = LIVE_CLEAN;

    const findings = evaluateAuthSettings(rest, EXPECTED);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('cannot be verified');
  });

  test('line endings and trailing spaces from a round trip through the API are not a difference', () => {
    const live = REPO_TEMPLATES.confirmation.replace(/\n/g, '  \r\n');

    expect(evaluateAuthSettings({ ...LIVE_CLEAN, mailer_templates_confirmation_content: live }, EXPECTED)).toEqual([]);
  });

  test('a repo copy that could not be read is a finding, never a silent pass', () => {
    const findings = evaluateAuthSettings(LIVE_CLEAN, { ...EXPECTED, templates: { confirmation: REPO_TEMPLATES.confirmation, recovery: REPO_TEMPLATES.recovery } });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('email_change');
  });

  test('several drifts are all reported, one line each', () => {
    const findings = evaluateAuthSettings({ ...LIVE_CLEAN, mailer_autoconfirm: true, site_url: 'x', mailer_templates_recovery_content: 'other' }, EXPECTED);

    expect(findings).toHaveLength(3);
  });
});

describe('normalizeTemplate', () => {
  test('makes line endings, trailing spaces and outer blank lines irrelevant', () => {
    expect(normalizeTemplate('\n a  \r\n b\t\n\n')).toBe(normalizeTemplate('a\n b'.replace('a', ' a')));
  });
});

describe('readExpectedRelease', () => {
  const yaml = 'environments:\n  local:\n    web_url: http://localhost:3000\n  dev:\n    web_url: https://fresco-dev.vercel.app\n  staging:\n    web_url: https://fresco-pre.vercel.app/\n  production:\n    web_url: https://fresco-pro.vercel.app\n';

  test('takes the production origin and every hosted one, never localhost, and the repo templates', () => {
    const release = readExpectedRelease(yaml, type => `template ${type}`);

    expect(release.siteUrl).toBe('https://fresco-pro.vercel.app');
    expect([...release.origins].sort()).toEqual(['https://fresco-dev.vercel.app', 'https://fresco-pre.vercel.app', 'https://fresco-pro.vercel.app']);
    expect(release.templates.recovery).toBe('template recovery');
  });

  test('a template that cannot be read is left out, so the comparison reports it', () => {
    const release = readExpectedRelease(yaml, type => (type === 'recovery' ? undefined : 'x'));

    expect(Object.keys(release.templates).sort()).toEqual(['confirmation', 'email_change']);
  });

  test('throws when the production origin is missing, so the check cannot silently expect nothing', () => {
    expect(() => readExpectedRelease('environments:\n  production: {}\n', () => 'x')).toThrow('web_url');
  });
});
