import { Resend } from 'resend';
import { renderSubscriptionConfirmationEmailHtml } from '@/lib/email/templates/subscription-confirmation';

// FRESCO-429: no owned/verified domain yet — same constraint ADR-0021 already
// accepted for the signup OTP email (project_resend_smtp_blocked). Resend
// restricts an account with no verified domain to delivering only to the
// account owner's own address, so real customers will not receive this email
// until a domain is bought and verified. Shipping the pipeline now anyway is
// deliberate: AC3 requires a graceful, logged failure rather than blocking
// the subscription, which is exactly what an unverified-sender rejection is.
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

export interface SendSubscriptionConfirmationEmailParams {
  to: string
  priceFormatted: string
  nextRenewalDateFormatted: string
  manageSubscriptionUrl: string
}

/**
 * Sends the FRESCO-429 durable-support subscription-confirmation email.
 * Callers (the Stripe webhook) are expected to wrap this in try/catch and
 * never let a failure here block the subscription write — see AC3.
 */
export async function sendSubscriptionConfirmationEmail(params: SendSubscriptionConfirmationEmailParams): Promise<void> {
  const { to, priceFormatted, nextRenewalDateFormatted, manageSubscriptionUrl } = params;

  const html = renderSubscriptionConfirmationEmailHtml({ priceFormatted, nextRenewalDateFormatted, manageSubscriptionUrl });

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
