# Auth email templates

These files mirror the **live** Supabase Auth email templates for project
`jdqemhewjrjuopssdurn` (shared by local / staging / production).

**Source of truth is the Supabase dashboard**, not this folder. The
`[auth.email.template.*]` blocks in `../config.toml` are intentionally left
commented — the templates are dashboard-managed. These `.html` copies exist so
template changes get a reviewable diff in a PR before they go live.

## Applying a change

Edit the `.html` here, get it reviewed, then push it with the Management API
(the dashboard UI works too):

```sh
# needs SUPABASE_ACCESS_TOKEN in the environment
curl -sS -X PATCH "https://api.supabase.com/v1/projects/jdqemhewjrjuopssdurn/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$(jq -n --rawfile c recovery.html \
    '{mailer_subjects_recovery: "Restablece tu contraseña en Fresco", mailer_templates_recovery_content: $c}')"
```

Field names: `mailer_subjects_<type>` / `mailer_templates_<type>_content`, where
`<type>` is `confirmation` | `recovery` | `email_change` | `magic_link` |
`invite`. A `PATCH` applies to all three environments at once.

## Current state (2026-09-03)

| Template | Status |
| --- | --- |
| `confirmation.html` | Full branded design (DEFECT-FRESCO-253/254/264) |
| `recovery.html` | Brought to match `confirmation.html` — FRESCO-422 |
| `email_change` / `magic_link` / `invite` | Supabase default English stubs, not customised (not wired here; magic-link and invite are unused today) |
