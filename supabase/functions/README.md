# Edge Functions — deploy notes

Eight functions, one shared project (`jdqemhewjrjuopssdurn`, which backs both
staging and prod). Type-check + lint run in `pr-check.yml` via `deno.json`; this
file is about **deploying**.

## Auto-deploy (FRESCO-414)

`.github/workflows/edge-functions-drift.yml` redeploys the functions that
changed on every `push: [staging]`, then verifies nothing drifted. `staging` is
the last hop before the manual `staging -> main` fast-forward, so `main` can no
longer carry function code that was never deployed (the audit-4 ola-3 bug: code
promoted to `main`, `reassign-guest-data` serving the exploitable v19 for ~24h).

A weekly scheduled run of the same workflow re-checks drift and opens a
`function-drift` issue if it finds any.

## Deploying by hand

```sh
supabase functions deploy <slug> \
  --project-ref jdqemhewjrjuopssdurn \
  --use-api \
  --import-map supabase/functions/deno.json
```

- **`--use-api`** bundles server-side, no Docker. With Docker off (the default
  on CI and usually locally) the plain `deploy` path fails.
- **`--import-map supabase/functions/deno.json` is required** — without it the
  remote bundler does not resolve `@supabase/supabase-js` / `web-push`.
- **`send-weekly-reengagement-push` needs `--no-verify-jwt`** appended. There is
  no `[functions.*]` block in `config.toml`, so the flag is re-applied on every
  deploy or JWT verification switches back on. `scripts/deploy-changed-functions.ts`
  handles this automatically.
- A change in **`_shared/**`** or **`deno.json`** means redeploying *every*
  function that imports it — in practice all eight.

Or just run the script the workflow uses:

```sh
SUPABASE_ACCESS_TOKEN=... bun scripts/deploy-changed-functions.ts <before-sha> <after-sha>
```

## Checking drift

```sh
SUPABASE_ACCESS_TOKEN=... bun scripts/check-functions-drift.ts
```

Compares each function dir's most recent commit time against the deployed
`updated_at` (the bundle hash is not locally recomputable). Exit 1 on drift.
