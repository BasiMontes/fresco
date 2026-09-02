# ADR-0021 — Keep the Gmail-SMTP email OTP for progressive signup through the early cohort

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Basi Montes (founder / solo maintainer)
- **Tags:** authentication, onboarding, email, deliverability, product
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Progressive signup (EPIC-FRESCO-7) converts a guest to a real account by
linking her email: `updateUser({ email })` on the still-anonymous session
sends a 6-digit code, `verifyOtp({ type: 'email_change' })` confirms it, then
the password is set (`app/signup/page.tsx`, `handleSubmit` → `handleVerifyOtp`,
FRESCO-89). This is the **only** conversion path from anonymous to registered —
if the code doesn't arrive, the guest can't create an account and her
generated menu is lost when the 3-day guest cleanup runs.

The code email is sent by a **Gmail SMTP sender configured in the hosted
Supabase Auth settings**. The audit (A4-M25) flagged this as fragile:

- No owned domain. A Gmail sender cannot publish SPF / DKIM / DMARC aligned
  to a Fresco domain, so receiving providers are more likely to spam-folder
  or throttle it, especially at burst (a cohort launch = many signups in a
  short window).
- No deliverability measurement — nothing recorded whether the code was
  sent, verified, or failed, so the size of the problem was unknown.
- `Resend` (the obvious upgrade) is **blocked**: the account has no verified
  owned domain and only a send-only API key, so switching to it today buys
  nothing over Gmail SMTP.

Buying a domain + setting up authenticated email is real work and cost that
is not justified before there is a cohort generating enough signups to
measure a deliverability problem against.

## Decision

**We will keep the Gmail-SMTP email OTP as the progressive-signup conversion
mechanism for the pre-cohort and early-cohort phase, and defer any change
(owned domain + authenticated email provider, or an email-independent
conversion path) until a reopen trigger below fires.**

The deliverability of the current setup is now **measured**, not assumed —
`app/signup/page.tsx` fires three PostHog events (FRESCO-390):

| Event          | Fires when                                                      |
| -------------- | -------------------------------------------------------------- |
| `otp_sent`     | a code email was accepted for delivery (`context: initial` on the first send, `context: resend` on "reenviar código") |
| `otp_verified` | the code was accepted by `verifyOtp` |
| `otp_failed`   | `verifyOtp` returned a genuine error (`reason` = the Supabase code, e.g. `otp_expired`) — the `email_exists` conflict branch is excluded, it belongs to a different funnel |

The funnel to watch: **`otp_verified` / `otp_sent`** (completion rate) and a
high **`context: resend`** share (first email lost). `user_signed_up
{ method: 'progressive_signup_otp' }` still fires alongside `otp_verified` —
that one means "a real account exists", these are the granular step.

## Consequences

- **Positive:** zero new cost or infra now. The conversion path already
  works. The decision is reversible on data, not vibes — the three events
  give a concrete number to argue against.
- **Negative / trade-offs:** we ship the cohort on an unauthenticated
  sender. Some fraction of guests will lose their generated menu to a code
  that never arrived, and we accept that fraction until it is measured and
  crosses a threshold. `otp_failed{ reason: 'otp_expired' }` cannot by
  itself distinguish "code went to spam and she found it too late" from
  "she fat-fingered it" — the `resend` rate is the better proxy for
  deliverability loss.
- **Neutral / follow-ups:** when a reopen trigger fires, the follow-up work
  is one of: (a) buy a domain, verify it with Resend, point Supabase Auth
  SMTP at it, publish SPF/DKIM/DMARC; or (b) add an email-independent path
  (deferred magic link that also works via a link she can copy, or an OAuth
  provider) so email is not the single point of failure. That is a new ADR,
  not an amendment to this one.

## Reopen triggers

Revisit this decision — write the follow-up ADR — when **any** of:

- `otp_verified` / `otp_sent` drops **below 80%** over a rolling window of
  ≥ 50 real (non-test) `otp_sent` events.
- The first credible user report of "the code went to spam" or "never
  arrived" (support message, feedback form, direct).
- A **paying** user hits an OTP failure during conversion (a churn risk on a
  revenue account, not just a funnel leak).
- Cohort size crosses **~100 signups/week**, where a burst of codes is more
  likely to trip Gmail's sending limits or a provider's rate reputation.
- A domain is acquired for any other reason (custom app domain, marketing) —
  authenticated email becomes nearly free at that point, so take it.

## Alternatives considered

- **Buy a domain + Resend now** — rejected: real cost and setup time before
  there is any measured problem to solve, and the current path works. Kept
  as the default follow-up once a trigger fires.
- **Switch to OAuth-only (Google) for conversion** — rejected: drops email
  as a factor entirely but forces a Google account on every guest and is a
  larger UX + auth-model change than the finding warrants; revisit only if
  email proves unfixable.
- **Deferred magic link instead of a code** — rejected for now: still an
  email, same deliverability exposure; only better if paired with a
  copyable link the user can move herself. Folded into follow-up option (b).
- **Do nothing / no instrumentation** — rejected: leaves the exact gap the
  audit flagged. The instrumentation is the cheap half of the fix and ships
  here.

## References

- FRESCO-390 (A4-M25) — this ADR + the `otp_sent` / `otp_verified` /
  `otp_failed` instrumentation.
- FRESCO-89 — the two-step `updateUser({ email })` → `verifyOtp` conversion
  flow (`app/signup/page.tsx`).
- EPIC-FRESCO-7 — Progressive Signup.
- ADR-0003 — guest auth via Supabase Anonymous Sign-In (the session this
  conversion upgrades).
- ADR-0004 — guest-data reassignment on email conflict (the sibling
  `email_exists` branch).
- ADR-0013 — PostHog as the analytics vendor (where these events land).
