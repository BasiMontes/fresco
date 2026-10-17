import type { SubscriptionConfirmationEmailParams } from '@/lib/email/templates/subscription-confirmation';
import { Resend } from 'resend';
import { renderSubscriptionConfirmationEmailHtml } from '@/lib/email/templates/subscription-confirmation';

// FRESCO-429: no owned/verified domain yet — same constraint ADR-0021 already
// accepted for the signup OTP email (project_resend_smtp_blocked). Resend
// restricts an account with no verified domain to delivering only to the
// account owner's own address, so real customers will not receive this email
// until a domain is bought and verified. Shipping the pipeline now anyway is
// deliberate: AC3 requires a graceful, logged failure rather than blocking
// the subscription, which is exactly what an unverified-sender rejection is.
// FRESCO-1005: "graceful" no longer means "silent". A rejected send is reported to Sentry and
// left pending for the reconcile cron (`lib/billing/confirmation-email.ts`).
const SEND_FROM = 'Fresco <onboarding@resend.dev>';

let cachedResend: Resend | undefined;

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required — copy .env.example to .env and fill it in');
  }
  cachedResend ??= new Resend(apiKey);
  return cachedResend;
}

export interface SendSubscriptionConfirmationEmailParams extends SubscriptionConfirmationEmailParams {
  to: string
}

/**
 * Sends the FRESCO-429 durable-support subscription-confirmation email.
 * Throws when Resend rejects the send. Callers must not let that block the
 * subscription write (AC3); `deliverSubscriptionConfirmation` is the one that
 * reports the failure and leaves a retry behind.
 */
export async function sendSubscriptionConfirmationEmail(params: SendSubscriptionConfirmationEmailParams): Promise<void> {
  const { to, ...content } = params;

  const html = renderSubscriptionConfirmationEmailHtml(content);

  const { error } = await getResend().emails.send({
    from: SEND_FROM,
    to,
    subject: 'Confirmación de tu suscripción a Fresco Pro',
    html,
  });

  if (error) {
    throw new Error(`Resend rejected the subscription confirmation email: ${error.message}`);
  }
}
