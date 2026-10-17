import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { CONTACT_EMAIL } from '@/lib/legal/entity';

/**
 * FRESCO-1005 — which provider sends the subscription confirmation. Gmail SMTP (the account Supabase
 * Auth already sends from) reaches real customers while there is no verified domain; it switches on
 * with `GMAIL_SMTP_APP_PASSWORD`. Without it the email goes through Resend, which delivers only to the
 * account owner until a domain is verified.
 *
 * One file for `gmail-smtp.ts` and `resend.ts` on purpose: `mock.module` leaks across test files, and
 * the second one needs the first one real.
 */

const resendSend = mock(async (_message: unknown): Promise<{ error: { message: string } | null }> => ({ error: null }));
void mock.module('resend', () => ({ Resend: class { emails = { send: resendSend }; } }));
const sendMail = mock(async (_message: unknown) => ({}));
const createTransport = mock((_options: unknown) => ({ sendMail }));
void mock.module('nodemailer', () => ({ default: { createTransport } }));

const { GMAIL_SMTP_PASSWORD_ENV, isGmailSmtpConfigured, sendViaGmailSmtp } = await import('./gmail-smtp');
const { sendSubscriptionConfirmationEmail } = await import('./resend');

const params = { to: 'ana@example.com', priceFormatted: '4,99 €', interval: 'month' as const, nextRenewalDateFormatted: '24 de octubre de 2026', manageSubscriptionUrl: 'https://fresco-pro.vercel.app/profile' };

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test';
  delete process.env[GMAIL_SMTP_PASSWORD_ENV];
  resendSend.mockClear();
  resendSend.mockResolvedValue({ error: null });
  sendMail.mockClear();
  sendMail.mockResolvedValue({});
  createTransport.mockClear();
});

describe('isGmailSmtpConfigured', () => {
  test('is off without the app password, and on with it', () => {
    expect(isGmailSmtpConfigured()).toBe(false);

    process.env[GMAIL_SMTP_PASSWORD_ENV] = 'app-password';
    expect(isGmailSmtpConfigured()).toBe(true);

    process.env[GMAIL_SMTP_PASSWORD_ENV] = '';
    expect(isGmailSmtpConfigured()).toBe(false);
  });
});

describe('sendViaGmailSmtp', () => {
  test('sends as the Gmail account the legal text names, over implicit TLS, authenticated with the app password', async () => {
    process.env[GMAIL_SMTP_PASSWORD_ENV] = 'app-password-1';

    await sendViaGmailSmtp({ to: 'ana@example.com', subject: 'Asunto', html: '<p>Hola</p>' });

    expect(createTransport).toHaveBeenCalledWith({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: CONTACT_EMAIL, pass: 'app-password-1' } });
    expect(sendMail).toHaveBeenCalledWith({ from: `Fresco <${CONTACT_EMAIL}>`, to: 'ana@example.com', subject: 'Asunto', html: '<p>Hola</p>' });
  });

  test('reuses the transport while the password is the same and rebuilds it when it is rotated', async () => {
    process.env[GMAIL_SMTP_PASSWORD_ENV] = 'app-password-2';
    await sendViaGmailSmtp({ to: 'a@example.com', subject: 's', html: 'h' });
    await sendViaGmailSmtp({ to: 'b@example.com', subject: 's', html: 'h' });
    expect(createTransport).toHaveBeenCalledTimes(1);

    process.env[GMAIL_SMTP_PASSWORD_ENV] = 'app-password-3';
    await sendViaGmailSmtp({ to: 'c@example.com', subject: 's', html: 'h' });
    expect(createTransport).toHaveBeenCalledTimes(2);
  });

  test('throws, naming the variable but never a value, when the password is missing', async () => {
    await expect(sendViaGmailSmtp({ to: 'a@example.com', subject: 's', html: 'h' })).rejects.toThrow(GMAIL_SMTP_PASSWORD_ENV);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('sendSubscriptionConfirmationEmail', () => {
  test('without the Gmail app password it goes through Resend, from the Resend sandbox sender', async () => {
    await sendSubscriptionConfirmationEmail(params);

    expect(sendMail).not.toHaveBeenCalled();
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(resendSend.mock.calls[0][0]).toMatchObject({ from: 'Fresco <onboarding@resend.dev>', to: 'ana@example.com', subject: 'Confirmación de tu suscripción a Fresco Pro' });
  });

  test('with the Gmail app password it goes through Gmail SMTP and never touches Resend', async () => {
    process.env[GMAIL_SMTP_PASSWORD_ENV] = 'app-password-5';

    await sendSubscriptionConfirmationEmail(params);

    expect(resendSend).not.toHaveBeenCalled();
    const sent = sendMail.mock.calls[0][0] as { from: string, to: string, subject: string, html: string };
    expect(sent.from).toBe(`Fresco <${CONTACT_EMAIL}>`);
    expect(sent.to).toBe('ana@example.com');
    expect(sent.subject).toBe('Confirmación de tu suscripción a Fresco Pro');
    expect(sent.html).toContain('Suscripción mensual');
  });

  test('a Resend rejection throws, so the caller reports it and queues the retry', async () => {
    resendSend.mockResolvedValue({ error: { message: 'You can only send testing emails to your own email address' } });

    await expect(sendSubscriptionConfirmationEmail(params)).rejects.toThrow('Resend rejected');
  });

  test('a Gmail failure throws too, without the password in the message', async () => {
    process.env[GMAIL_SMTP_PASSWORD_ENV] = 'app-password-6';
    sendMail.mockRejectedValue(new Error('Invalid login: 535 Username and Password not accepted'));

    const failure = await sendSubscriptionConfirmationEmail(params).catch((error: Error) => error);

    expect((failure as Error).message).toContain('535');
    expect((failure as Error).message).not.toContain('app-password-6');
  });
});
