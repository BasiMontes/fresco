# Hosted Auth settings check

FRESCO-1090 (audit 8, A8-AUTHZ-04). Some of the rules the app relies on for accounts are toggles of the **hosted** Supabase project, not code: whether GoTrue refuses a password change that does not carry the current password, whether an email change is confirmed on both addresses, whether captcha guards the Auth endpoints. `supabase/config.toml` configures the local stack only, and it has no key for the current-password toggle at all, so the repo cannot say what production does.

Audits 7 and 8 could only grade the finding PLAUSIBLE for that reason. The check below makes the hosted state readable and keeps it that way.

## What it checks

`scripts/check-hosted-auth-settings.ts` reads the Auth settings of the production project through the Supabase Management API (read only) and compares them with what the app relies on. The list of settings, and why each one matters, lives in `EXPECTED_TRUE` and `MIN_PASSWORD_LENGTH` in that script. Change the expectation there, with its reason, never in this page.

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
