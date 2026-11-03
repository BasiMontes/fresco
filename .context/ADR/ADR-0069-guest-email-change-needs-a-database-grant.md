# ADR-0069 — A guest's pending email can only be written with a one-shot database grant

- **Status:** Proposed
- **Date:** 2026-11-03
- **Deciders:** Founder (approval pending); drafted by AI workflow (FRESCO-1085, audit 8 A8-ABUSE-01, eje Seguridad)
- **Tags:** authentication, guest-mode, abuse-control, security, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

FRESCO-1006 moved the guest-to-account email step to `POST /api/auth/guest-email` (captcha, 3 an hour per guest). A guest holds a normal Supabase session, so the same token can call `PUT /auth/v1/user {email}` on Auth directly: no captcha, no limit of ours, one mail per call to any address, drawn from the Auth email quota shared by dev, staging and production (audit 8 A8-ABUSE-01, still open from A7-ABUSE-02). The 3-an-hour limit is keyed on `user.id`, which a disposable guest rotates. Supabase does not enforce captcha on `updateUser({ email })` (`lib/auth/turnstile-verify.ts`), and a route cannot guard an endpoint it does not sit in front of.

## Decision

**We will make the database refuse to store a pending email for an anonymous user unless a one-shot grant exists, and only the app route can create one.**

- Auth writes the pending address to `auth.users.email_change` and stamps `email_change_sent_at` before it mails anything. A `BEFORE UPDATE` trigger on `auth.users` (`guest_email_change_requires_grant`) raises when an anonymous user's `email_change` or its send stamp changes to a non-empty value without a grant.
- The grant is a row in `public.guest_email_change_grants` valid for 60 seconds, consumed by the write. `grant_guest_email_change(uuid)` creates it and is executable by `service_role` only.
- `POST /api/auth/guest-email` creates the grant after the captcha, the 3-an-hour per-guest limit and a new per-IP limit (10 an hour, `check_ip_rate_limit`), and fails closed if the service-role client or either limit is unavailable.

Invariant: no path other than that route may make Auth mail a guest-typed address.

## Consequences

- **Positive:** the direct `PUT /auth/v1/user` is refused before any mail, so the abuse is closed at the source and can be measured at zero, in production too, without sending a message. The per-IP limit covers the guest that rotates `user.id`. No new vendor, no Auth hook.
- **Negative / trade-offs:** a trigger on `auth.users`, a table Supabase owns: a bug there breaks Auth writes, so it is limited by `WHEN` to anonymous users whose pending email changes. A grant that Auth does not consume (for example `email_exists`, which fails before the write) stays valid up to 60 seconds, enough for one extra direct send per route-approved request, never more than the route allows. The route now needs `SUPABASE_SERVICE_ROLE_KEY` in every environment it runs in.
- **Neutral / follow-ups:** the hosted minimum interval between emails (`max_frequency`) and `email_sent` stay an owner setting, not touched here. The local stack autoconfirms email changes, so the Auth-level test runs only with `enable_confirmations = true`; the pgTAP test pins the trigger on any config.

## Alternatives considered

- **Send Email hook.** Rejected: a hook replaces the sender, so it would need our own mail sender and the same counters; it moves the problem instead of closing it.
- **Captcha and limit only on the route (FRESCO-1006).** Rejected: this is the state audit 8 found open.
- **Hosted Auth settings only** (longer minimum interval, lower `email_sent`). Rejected as the fix: it slows the abuse and starves real users sharing the quota, it does not stop it.
- **Block the guest's own `PUT /auth/v1/user` at the edge or proxy.** Rejected: Auth is reached directly at the Supabase URL, not through this app.

## References

- `.context/audits/2026-11-03-audit-8/w5-03-abuse.md` A8-ABUSE-01; FRESCO-1085, FRESCO-1006.
- ADR-0003 (guest sign-in), ADR-0010 (atomic rate limiting), ADR-0021 (email sender).
- `supabase/migrations/20261103180000_guest_email_change_grant_guard.sql`, `supabase/tests/guest_email_change_grant.test.sql`, `tests/db/guest-email-direct-auth.test.ts`.
