# Comments for FRESCO-84

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-84)

---

### Basi Montes - 8/6/2026, 11:12:41 AM

## Acceptance Criteria

```gherkin
Feature: Plan de suscripción en el sidebar

Scenario: Ver mi plan Free en el pie de la barra lateral
  Given que mi cuenta tiene el plan Free
  When abro cualquier pantalla de la aplicación con sesión activa
  Then veo una etiqueta "Free" junto a mis datos de cuenta en el pie de la barra lateral

Scenario: Ver mi plan Pro en el pie de la barra lateral
  Given que mi cuenta tiene el plan Pro
  When abro cualquier pantalla de la aplicación con sesión activa
  Then veo una etiqueta "Pro" junto a mis datos de cuenta en el pie de la barra lateral

Scenario: Ver mi plan Family en el pie de la barra lateral
  Given que mi cuenta tiene el plan Family
  When abro cualquier pantalla de la aplicación con sesión activa
  Then veo una etiqueta "Family" junto a mis datos de cuenta en el pie de la barra lateral

Scenario: La etiqueta no aparece sin sesión activa
  Given que no inicié sesión
  When estoy en la pantalla de acceso o de registro
  Then no veo ninguna etiqueta de plan en la barra lateral
```

---

### Basi Montes - 8/6/2026, 11:12:42 AM

## Scope

- Ver una etiqueta con su plan actual (Free, Pro o Family) junto a sus datos de cuenta en el pie de la barra lateral.
- La etiqueta refleja el plan real de su cuenta en cada carga de pantalla.

---

### Basi Montes - 8/6/2026, 11:12:44 AM

## Out Of Scope

- Cambiar, actualizar o cancelar el plan desde este componente (futura historia de gestión de suscripción/billing).
- Mostrar detalles de facturación (fecha de renovación, método de pago, historial de cobros).
- Explicar o promocionar las diferencias entre planes (upsell) desde este componente.

---

### Basi Montes - 8/6/2026, 11:12:45 AM

## Business Rules Specification

- La etiqueta de plan sigue la misma regla de visibilidad que el resto del footer de cuenta (FRESCO-82): solo se muestra con sesión activa.
- El texto de la etiqueta es "Free plan" / "Pro plan" (terminología canónica de business/domain-glossary.md) — nunca describir el plan como un nivel de acceso o permiso.

---

### Basi Montes - 8/6/2026, 11:20:50 AM

## Spec Implementation Plan (Dev)

## Goal

Add a plan-tier label ("Plan Free" / "Plan Pro" / "Plan Family") to the existing `SidebarAccount` footer block shipped by FRESCO-82, so the signed-in user sees their subscription plan at a glance without leaving the current screen. No new data-fetch mechanism — reuse `getUserPlan()` (`lib/api/user-profile.ts:152`) exactly as already implemented and already consumed by `/profile` and `/calendar`.

## Current state (verified against live code, post-FRESCO-82)

- `app/(app)/layout.tsx` fetches `nombre` via a single `getUserNombre(supabase, user?.id).catch(...)` call and passes `user ? { nombre, email } : null` into `<AppShell>`.
- `AccountUser` (defined + exported from `components/layout/sidebar-account.tsx`) currently has only `nombre` and `email`. It is reused as-is by `Sidebar` and `AppShell` — no duplicate type declarations.
- `Sidebar` (`components/layout/sidebar.tsx`) only mounts `<SidebarAccount>` when `user` is truthy — this is the existing no-session guard and it already satisfies AC Scenario 4 with zero new code.
- `Sidebar` currently spreads individual props: `<SidebarAccount nombre={user.nombre} email={user.email} />`.
- `getUserPlan(client, userId?)` → `Promise<UserProfile['plan']>`, enum `'free' | 'pro' | 'family'`, defaults to `'free'` when no profile row exists. Verified signature matches the story's assumption exactly — no new mechanism needed.
- A plan-label pattern already ships in `app/(app)/profile/page.tsx`: `const PLAN*LABELS = { free: 'Plan Free', pro: 'Plan Pro', family: 'Plan Family' } as const;` rendered as `<Tag variant={plan === 'free' ? 'neutral' : 'accent'}>{PLAN*LABELS[plan]}</Tag>`. `Tag`'s `accent` variant resolves to DESIGN.md's real `tag-accent` token (`colors.accent-200` background / `colors.accent-800` text) — the same visual language already used to mark "Pro" content elsewhere (e.g. `card-insight`). No new color needs inventing.
- `sidebar-account.tsx`'s own doc comment states this codebase's convention: independent local copies of small patterns instead of premature extraction (cites `danger-zone.tsx` / `update-password/page.tsx`'s duplicated 3-line logout sequence as precedent).

## Technical decision — label text + component reuse

Business Rules Specification (Jira comment) says the label text is "Free plan" / "Pro plan"; the AC Gherkin literally shows just `"Free"`. Neither matches what is **already live** in `/profile`: `"Plan Free"` / `"Plan Pro"` / `"Plan Family"`.

Per this repo's Rule 14 (LIVE-UI-FIRST — the running UI is the fidelity source of truth, not a spec fragment) and the fact no `master-design-plan.md` §8 row exists for this story (degrades to DESIGN.md-only fidelity), this plan uses the ***already-shipped exact strings and component*** from `/profile/page.tsx`: `Plan Free` / `Plan Pro` / `Plan Family`, via the same `Tag` component and the same `neutral`/`accent` variant split. This keeps plan terminology visually and textually consistent across the two screens that show it (`/profile` and the sidebar) instead of introducing a second, slightly different copy of the same fact. Flagging this explicitly for confirmation at Stage 3 review — if the team wants the literal Jira-comment wording instead, it is a one-line copy change, not a structural one.

The `PLAN_LABELS` map is ***duplicated locally*** inside `sidebar-account.tsx` (not imported from `/profile/page.tsx` and not extracted to a shared module) — matching the codebase's own stated convention of local copies for small, single-file patterns, and avoiding any edit to `/profile/page.tsx` (already shipped, already in `Control de calidad`, out of this story's scope).

## Implementation steps

1. `app/(app)/layout.tsx` — import `getUserPlan` alongside `getUserNombre`. Replace the single `await getUserNombre(...)` with `Promise.all([getUserNombre(...), getUserPlan(...)])` (both reads are already mutually independent — no reason to pay for two sequential round trips). `getUserPlan`'s `.catch()` mirrors the exact conservative-default pattern already used in `/profile/page.tsx` and `/calendar/page.tsx`: log and default to `'free'`. Pass `plan` into the `AccountUser` object: `user ? { nombre, email: user.email ?? '', plan } : null`.

1. `components/layout/sidebar-account.tsx` —

1. `components/layout/sidebar.tsx` — update the `<SidebarAccount>` call site to also pass `plan={user.plan}` (currently spreads `nombre`/`email` individually, so this is a one-line addition, not a structural change).

1. `components/layout/app-shell.tsx` — no code change required. `AppShellProps.user` is already typed as `AccountUser | null` and forwards the whole object to `<Sidebar user={user} />`; it inherits the new `plan` field automatically once `AccountUser` is extended in step 2.

## AC scenario → implementation step map

| # | Gherkin scenario | Covered by |
| --- | --- | --- |
| 1 | Ver mi plan Free en el pie de la barra lateral | Step 1 (`getUserPlan` resolves `'free'`) + Step 2 (`PLAN_LABELS.free` = "Plan Free", `Tag variant="neutral"`) |
| 2 | Ver mi plan Pro en el pie de la barra lateral | Step 1 (`getUserPlan` resolves `'pro'`) + Step 2 (`PLAN_LABELS.pro` = "Plan Pro", `Tag variant="accent"`) |
| 3 | Ver mi plan Family en el pie de la barra lateral | Step 1 (`getUserPlan` resolves `'family'`) + Step 2 (`PLAN_LABELS.family` = "Plan Family", `Tag variant="accent"`) |
| 4 | La etiqueta no aparece sin sesión activa | Already satisfied by the existing FRESCO-82 guard in `sidebar.tsx` (`{user && <SidebarAccount ... />}`) — no new code; confirm unchanged at Stage 3 review |

## Definition of Done cross-check

- Plan label visible in the sidebar account footer, next to nombre/email — Step 2.
- Reuses `getUserPlan()` without duplicating the `plan` field read — Step 1, single call site.
- Light/dark mode — `Tag`'s `neutral`/`accent` variants are already-shipped DESIGN.md tokens, no new CSS.
- Responsive — no new breakpoints; sits inside the existing `min-w-0 flex-1` column that already handles truncation for `nombre`/`email`.
- Deploy — `solo-main`, no intermediate staging (per `.agents/project.yaml` git_strategy).

## Files to touch (Stage 2)

- `app/(app)/layout.tsx`
- `components/layout/sidebar-account.tsx`
- `components/layout/sidebar.tsx`

No changes to `app/(app)/profile/page.tsx`, `lib/api/user-profile.ts`, or any Supabase/DB layer — `getUserPlan()` is reused exactly as-is.

## Review Workload Forecast

Estimated: ~20 additions + ~6 deletions = ~26 total lines
400-line budget risk: Low
Chain strategy: pending
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
