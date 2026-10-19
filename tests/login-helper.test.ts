import type { Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { loginToApp } from './test-helpers';

/**
 * FRESCO-843. A step that fills `/login` itself breaks against a hosted backend
 * with the captcha on (FRESCO-799), and 14 step files did exactly that. The
 * guard below keeps the form login in one place, `loginToApp`, plus the
 * `@login` scenarios, whose whole point is the form.
 */

const STEPS_DIR = join(import.meta.dir, 'steps');
const FORM_LOGIN_ALLOWED = new Set(['login.steps.ts']);

describe('form login stays out of the step files (FRESCO-843)', () => {
  it('no step file outside @login drives the login submit button', () => {
    const offenders = readdirSync(STEPS_DIR)
      .filter(file => file.endsWith('.steps.ts') && !FORM_LOGIN_ALLOWED.has(file))
      .filter(file => readFileSync(join(STEPS_DIR, file), 'utf8').includes('login_submit_button'));
    expect(offenders).toEqual([]);
  });
});

describe('loginToApp', () => {
  const original = process.env.E2E_SESSION_LOGIN;

  beforeEach(() => {
    delete process.env.E2E_SESSION_LOGIN;
  });

  afterEach(() => {
    if (original === undefined) { delete process.env.E2E_SESSION_LOGIN; }
    else { process.env.E2E_SESSION_LOGIN = original; }
  });

  it('drives the real form, in order, when session login is off', async () => {
    const calls: string[] = [];
    const page = {
      goto: async (url: string) => { calls.push(`goto ${url}`); },
      getByTestId: (id: string) => ({
        fill: async (value: string) => { calls.push(`fill ${id}=${value}`); },
        click: async () => { calls.push(`click ${id}`); },
        isVisible: async () => false,
      }),
      waitForURL: async (predicate: (url: URL) => boolean) => {
        expect(predicate(new URL('http://app.test/menu'))).toBe(true);
        expect(predicate(new URL('http://app.test/onboarding'))).toBe(true);
        expect(predicate(new URL('http://app.test/login'))).toBe(false);
        calls.push('waitForURL');
      },
    } as unknown as Page;

    await loginToApp(page, { email: 'qa@example.com', password: 'secret-pass' });

    expect(calls).toEqual([
      'goto /login',
      'fill email_input=qa@example.com',
      'fill password_input=secret-pass',
      'click login_submit_button',
      'waitForURL',
    ]);
  });

  it('FRESCO-1007: accepts the re-consent dialog when an old account hits it', async () => {
    const calls: string[] = [];
    const page = {
      goto: async () => {},
      getByTestId: (id: string) => ({
        fill: async () => {},
        click: async () => { calls.push(`click ${id}`); },
        isVisible: async () => id === 'reconsent_dialog',
        waitFor: async () => { calls.push(`waitFor ${id}`); },
      }),
      waitForURL: async () => {},
    } as unknown as Page;

    await loginToApp(page, { email: 'qa@example.com', password: 'secret-pass' });

    expect(calls).toEqual([
      'click login_submit_button',
      'click confirm_age_checkbox',
      'click accept_terms_checkbox',
      'click reconsent_accept_button',
      'waitFor reconsent_dialog',
    ]);
  });
});
