# Hosted Auth settings check

FRESCO-1090 (audit 8, A8-AUTHZ-04). Some of the rules the app relies on for accounts are toggles of the **hosted** Supabase project, not code: whether GoTrue refuses a password change that does not carry the current password, whether an email change is confirmed on both addresses, whether captcha guards the Auth endpoints. `supabase/config.toml` configures the local stack only, and it has no key for the current-password toggle at all, so the repo cannot say what production does.

Audits 7 and 8 could only grade the finding PLAUSIBLE for that reason. The check below makes the hosted state readable and keeps it that way.

## What it checks

`scripts/check-hosted-auth-settings.ts` reads the Auth settings of the production project through the Supabase Management API (read only) and compares them with what the app relies on. The list of settings, and why each one matters, lives in `EXPECTED_TRUE` and `MIN_PASSWORD_LENGTH` in that script. Change the expectation there, with its reason, never in this page.

FRESCO-1188 (integral review A3) widened it to what the confirmation and recovery emails depend on, which also lives in the hosted project:

| Setting | Expected | Why |
|---|---|---|
| `mailer_autoconfirm` | `false` | with it on, the confirmation email never proves anyone owns the address they signed up with |
| `site_url` | the production `web_url` of `.agents/project.yaml` | the recovery email builds its link from it |
| `uri_allow_list` | covers `<origin>/auth/confirm?next=/onboarding` for every hosted origin of `.agents/project.yaml` (production, staging, dev) and has no bare `*` / `**` | the sign-up confirmation redirects there from each environment, and a bare wildcard is an open redirect |
| `rate_limit_email_sent` | readable as a positive number | it caps sign-up and recovery emails; the check only proves it can be read |
| `mailer_templates_{confirmation,recovery,email_change}_content` | equal to `supabase/templates/<type>.html` (line endings and trailing spaces ignored) | the templates are pushed by hand through the Management API (`supabase/templates/README.md`), so the repo copy can silently stop being the live one. A difference prints the template name and the first differing line, never the content |

FRESCO-1169 (integral review F2) added the Edge Functions: `supabase/config.toml` declares `verify_jwt` for each of the nine (`[functions.<slug>]`), and the check reads the live list (`GET /v1/projects/{ref}/functions`) and compares it function by function. A live value that differs, a declared function that is not deployed, a deployed function with no declaration, or a value the API does not return as a boolean is a finding. Seven require a session (`true`); `send-weekly-reengagement-push` and `retry-posthog-erasures` are `false` because pg_cron calls them with the service key in `apikey`, which the platform's JWT gate rejects, and they authenticate inside the function (`requireServiceRoleCaller`). `scripts/deploy-changed-functions.ts` reads the same blocks, so a deploy cannot flip them. `scripts/edge-function-config.test.ts` also fails when a function directory has no block, or when its value contradicts the auth helper its code calls. When a finding is real: redeploy the function with `bun scripts/deploy-changed-functions.ts`, or edit the declaration with its reason.

The SMTP sender is not checked: production sends Auth email through Supabase's default sender until the owned domain exists (see the Resend note in `docs/workflows/stripe-go-live.md`), so there is nothing to compare yet. Add it here when a custom SMTP is configured.

The first run after this change can report real drift (for example a hosted allow-list that does not list every origin, or a template edited in the dashboard); that is the check working, not a false alarm. Fix the hosted project or commit the live template.

It fails closed. A setting the API does not return, or returns as something other than a boolean, is a finding: "could not read it" is the failure this check exists to end.

| Exit | Meaning |
|---|---|
| 0 | every expected setting is as expected |
| 1 | one or more settings differ, or are missing from the response |
| 2 | the settings could not be read at all (no token, HTTP error) |

The production project ref comes from `environments.production.db_project_ref` in `.agents/project.yaml`.

## When it runs

`.github/workflows/hosted-auth-settings-check.yml`, every week and on demand (`workflow_dispatch`). It is not in the per-PR pipeline because it needs a token for the production project (ADR-0017, `docs/workflows/ci-secrets.md`). While a run is red it keeps one open issue labelled `hosted-auth-drift` and comments on it each week; the first green run closes it.

## Repeat it by hand

```sh
bunx varlock run --no-redact-stdout -- bun scripts/check-hosted-auth-settings.ts
```

The token is read from `SUPABASE_ACCESS_TOKEN` by name and never printed: the script prints setting names and booleans only. `--no-redact-stdout` is there because `varlock` redacts any `.env` value found in the output, and a very short value (a flag, a port) garbles harmless text such as `true`.

## When it goes red

- A setting is `false`: turn it back on in the Supabase dashboard (Authentication), or accept the change on purpose by editing the expectation in the script together with its reason.
- Exit 2: the token lost access (rotated or expired). Replace `SUPABASE_ACCESS_TOKEN` in the repository secrets. This check only reads, so it needs no write permission.
