import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import { CONTACT_EMAIL } from '@/lib/legal/entity';

/**
 * FRESCO-1005 — a sender that reaches real customers while Fresco has no verified domain.
 *
 * Resend delivers from `onboarding@resend.dev` only to the account owner until a domain is
 * verified (FRESCO-886), and the founder's no-spend rule keeps that off the table for now. Supabase
 * Auth already sends its own mail through the Gmail account in `CONTACT_EMAIL`, so the same
 * account can send the subscription confirmation, with an app password, at no cost.
 *
 * The password is read from `GMAIL_SMTP_APP_PASSWORD` and is the only thing that switches this
 * path on: unset, `sendSubscriptionConfirmationEmail` keeps using Resend. It is never logged and
 * never part of an error message. Gmail only lets a message go out as the authenticated address,
 * so the sender is `CONTACT_EMAIL` (the address the legal text already names).
 *
 * Remove this file, and the branch in `resend.ts`, once the domain is verified.
 */

export const GMAIL_SMTP_PASSWORD_ENV = 'GMAIL_SMTP_APP_PASSWORD';

const SMTP_HOST = 'smtp.gmail.com';
/** Implicit TLS. */
const SMTP_PORT = 465;

let cachedTransport: { password: string, transport: Transporter } | undefined;

export function isGmailSmtpConfigured(): boolean {
  return Boolean(process.env[GMAIL_SMTP_PASSWORD_ENV]);
}

function getTransport(password: string): Transporter {
  // Rebuilt when the password changes, so a rotated value is picked up without a restart.
  if (cachedTransport?.password !== password) {
    cachedTransport = {
      password,
      transport: nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: true, auth: { user: CONTACT_EMAIL, pass: password } }),
    };
  }
  return cachedTransport.transport;
}

export async function sendViaGmailSmtp({ to, subject, html }: { to: string, subject: string, html: string }): Promise<void> {
  const password = process.env[GMAIL_SMTP_PASSWORD_ENV];
  if (!password) {
    throw new Error(`${GMAIL_SMTP_PASSWORD_ENV} is not set`);
  }

  await getTransport(password).sendMail({ from: `Fresco <${CONTACT_EMAIL}>`, to, subject, html });
}
