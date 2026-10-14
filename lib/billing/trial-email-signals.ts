/**
 * FRESCO-923 (audit C-22): the signal that tells alias-account trial abuse from
 * ordinary sign-ups, attached to the `trial_started` PostHog event.
 *
 * The raw address is never sent. The domain is kept only for well-known public
 * mail providers (a company domain could identify an employer), and the alias
 * flag is a boolean. PostHog then shows the rate of `+` aliases per provider.
 */

const PUBLIC_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'outlook.es',
  'hotmail.com',
  'hotmail.es',
  'live.com',
  'yahoo.com',
  'yahoo.es',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
]);

export interface TrialEmailSignals {
  email_domain: string
  email_plus_alias: boolean
}

/** Returns `null` when the address is missing or malformed: the event then goes without the signals. */
export function trialEmailSignals(email: string | null | undefined): TrialEmailSignals | null {
  const at = email?.lastIndexOf('@') ?? -1;
  if (!email || at < 1 || at === email.length - 1) {
    return null;
  }
  const domain = email.slice(at + 1).toLowerCase();
  return {
    email_domain: PUBLIC_MAIL_DOMAINS.has(domain) ? domain : 'other',
    email_plus_alias: email.slice(0, at).includes('+'),
  };
}
