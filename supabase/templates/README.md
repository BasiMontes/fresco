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

## Current state (2026-09-08)

| Template | Status |
| --- | --- |
| `confirmation.html` | Branded; aligned to the FRESCO-436 editorial redesign (20px card, hairline, calm voice) — FRESCO-467. Typography moved to Young Serif and Figtree in FRESCO-1198 |
| `recovery.html` | Same alignment pass — FRESCO-467 |
| `email_change.html` | Branded, Spanish, **code-based** (`{{ .Token }}` — the progressive-signup guest→account OTP the app types into `verifyOtp`). Was the Supabase default English link stub before FRESCO-467. |
| `magic_link` / `invite` | Supabase default English stubs, not customised (not wired here; both unused today) |

## Design source

These templates render in third-party email clients (no CSS custom properties, hand-tuned
`font-size` for a 600px card), so they do **not** conform to the app's `DESIGN.md` type
ramp / token literals and are excluded from the `impeccable` design hook via
`.agents/` config. They DO follow `DESIGN.md` on the things that carry the brand: the
palette (`#0F4E0E` / `#DF8C26` / `#FBF6EC` / `#201E1D` / border at 16%), Young Serif as the
display face (titles only) and Figtree for everything else, buttons and the code included, with Georgia and the
system sans as the fallback (FRESCO-1198; `lib/email/templates/email-typography.test.ts` pins it), the 20px card radius + unconditional hairline, the
full-pill CTA, and the §Voice rules (calm, no exclamation, no filler emoji).

## Fonts

The two font files the emails ask for (`young-serif-v2-latin-400.woff2`, `figtree-v9-latin-wght.woff2`) live in
`public/fonts/` with their SIL OFL licences, and the templates request them from
`https://fresco-pro.vercel.app/fonts/`, never from Google (FRESCO-1198): the waitlist email goes to people who have not
confirmed yet, and the privacy text names no font provider. The URL is the production one for every environment, so a
change to the Auth templates that points at a NEW font file only works once that file is on `main`. Gmail and other
clients ignore web fonts: there Georgia and the system sans carry the brand. Never rename a font file without changing
its version in the name: `next.config.mjs` serves `/fonts/` as immutable.
