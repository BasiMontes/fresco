# IMPROVEMENT: Rediseñar plantilla de email de confirmación de cuenta (signup)

**Jira Key:** [FRESCO-251](https://basiliomontescastano.atlassian.net/browse/FRESCO-251)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Context

Found while working FRESCO-250 (signup confirmation redirect bug). The Supabase "Confirm signup" email template was functional but visually bland — plain layout, no real hierarchy, CTA in the wrong brand color (green instead of the accent orange reserved for high-intent actions).

## What changed

Rebuilt as a standalone, table-based HTML email (Outlook-safe via VML fallback for the pill button), built directly from `DESIGN.md`'s tokens — nothing invented:

- Cream card (`#F1E3C6`) on cream background (`#FAF3E3`), 32px radius (`rounded.card` token)
- CTA button in accent orange (`#DF8C26`) — the token reserved for the single highest-intent action per DESIGN.md, not the primary green (which stays for trust/structure)
- Caprasimo for headline + button label, Figtree for body — both loaded via Google Fonts with the project's documented fallback stacks
- Real logo (`public/brand/logo-negativo-email.png`, the actual icon+wordmark lockup — Satoshi Black) embedded as a base64 data URI at correct aspect ratio (176×54), not hotlinked — avoids any dependency on a specific deployed origin and any CSP/hotlink-blocking issue
- Preheader text, MSO conditional comments, responsive stacking for mobile

## Not managed in this repo

This template lives in the Supabase Dashboard (Authentication → Emails → Confirm signup) — there is no code path in this repo that owns it, no PR/deploy applies here. The finished HTML is attached as a comment on this ticket; applying it is a manual paste into the dashboard.

## Done when

- [ ] HTML pasted into Supabase Dashboard → Authentication → Emails → Confirm signup
- [ ] Test signup sent and confirmation email visually verified in a real inbox

---

## Metadata

- **Created:** 8/21/2026
- **Updated:** 8/23/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
