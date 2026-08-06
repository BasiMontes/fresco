# Comments for FRESCO-82

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-82)

---

### Basi Montes - 8/6/2026, 9:40:55 AM

## Acceptance Criteria

```gherkin
Feature: Cuenta y sesión en el sidebar

Scenario: Ver los datos de mi cuenta en el pie de la barra lateral
  Given que inicié sesión en Fresco
  When abro cualquier pantalla de la aplicación
  Then veo mi nombre y correo electrónico en el pie de la barra lateral
  And veo un avatar o inicial que me identifica como la usuaria activa

Scenario: Cerrar sesión desde la barra lateral
  Given que veo mis datos de cuenta en el pie de la barra lateral
  When selecciono la opción de cerrar sesión
  Then mi sesión se cierra
  And soy redirigida a la pantalla de acceso

Scenario: El componente no aparece sin sesión activa
  Given que no inicié sesión
  When estoy en la pantalla de acceso o de registro
  Then no veo información de cuenta ni la opción de cerrar sesión en la barra lateral

Scenario: Mi nombre o correo son demasiado largos para el espacio disponible
  Given que mi nombre o correo electrónico exceden el ancho del pie de la barra lateral
  When abro cualquier pantalla de la aplicación
  Then el texto se trunca visualmente sin desbordar el diseño de la barra lateral
  And puedo seguir identificando el inicio de mi nombre o correo
```

---

### Basi Montes - 8/6/2026, 9:40:57 AM

## Scope

- Ver su nombre y correo electrónico en el pie de la barra lateral, visible en cualquier pantalla de la app con sesión activa.
- Ver un avatar o inicial que la identifica visualmente como usuaria de la sesión activa.
- Cerrar sesión con una única acción disponible en ese mismo lugar.
- Ser redirigida a la pantalla de acceso al cerrar sesión.

---

### Basi Montes - 8/6/2026, 9:49:46 AM

## Spec Implementation Plan (Dev)

# FRESCO-82 — Implementation Plan

Story: Cuenta | Ver datos de la cuenta y cerrar sesión desde el sidebar
Epic: FRESCO-81 (Cuenta y Sesión)

## Solution summary

Spec-only build — no mockup exists for this story (`.context/design/master-design-plan.md` is absent from this repo), fidelity is based on `DESIGN.md` tokens plus reuse of the sidebar and avatar patterns already live in the app. This is a ratified divergence per this project's UI-fidelity rule (no mockup available, pre-approved for this ticket).

***Session data.*** No new session mechanism is introduced. The story reuses the exact pattern already used by `app/(app)/profile/page.tsx`: a Server Component calls `createClient()` from `lib/supabase/server.ts`, then `supabase.auth.getUser()` for `email`, and the existing `getUserNombre(supabase, user?.id)` export from `lib/api/user-profile.ts` for the display name. `app/(app)/layout.tsx` becomes that Server Component fetch point — it already wraps every authenticated route (`menu`, `calendar`, `recipes`, `profile`) via `AppShell`, so fetching once there and passing `{ email, nombre }` down avoids a duplicate query per page.

***Component location.*** A new client component `components/layout/sidebar-account.tsx` renders the footer block (avatar + name/email + logout button) and is mounted inside the existing `Sidebar` (`components/layout/sidebar.tsx`, already `'use client'` for `usePathname`), pinned to the bottom of the `<aside>` flex column with `mt-auto` and separated by a top divider, mirroring the `bg-background/10` treatment the sidebar already uses for its hover states.

***Logout.*** Reuses the exact working call already shipped in `components/profile/danger-zone.tsx`: `createClient()` from `lib/supabase/client.ts` (browser client) → `client.auth.signOut()` → `router.push('/login')`, with the same `isLoggingOut`/error-message local state shape. This handler is duplicated locally inside `sidebar-account.tsx` rather than extracted into a shared hook — matching the codebase's existing convention: `danger-zone.tsx` and `app/update-password/page.tsx` already implement this same 3-line pattern independently rather than sharing a hook, so a third local copy is consistent with the established pattern, not a new abstraction gap.

***Avatar / design-system reuse.*** No dedicated `Avatar` or `Dropdown` component exists yet under `components/ui/`. The story reuses the exact avatar visual already shipped on `/profile` (`app/(app)/profile/page.tsx` lines 96-102): a `rounded-full bg-primary text-background` circle showing the first letter of `nombre` uppercased, falling back to the `lucide-react` `User` icon when no name is set — same fallback semantics, scaled down for the sidebar footer (`size-9` instead of `size-12`).

## Non-trivial technical decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Where truncation logic lives | CSS (Tailwind `truncate` + `min-w-0` on the flex text container) | Matches the "keep the start visible, ellipsis at the end" AC exactly, with zero JS and no responsive-width recalculation; `min-w-0` is already an established pattern in this codebase for exactly this class of overflow bug (see `app-shell.tsx`'s comment on its own `min-w-0` usage). |
| How "no active session" is detected | Structural — no runtime check | `Sidebar`/`AppShell` only ever mount inside `app/(app)/layout.tsx`. `/login`, `/signup`, `/onboarding`, `/forgot-password`, `/update-password` are all top-level routes (`app/login/page.tsx`, `app/signup/page.tsx`, …) outside the `(app)` route group and never render `AppShell` at all — confirmed by listing `app/*/page.tsx` before writing this plan. So AC "component doesn't appear without an active session" is guaranteed by Next.js route-group placement, not by a client-side session check. |
| Where the user fetch happens | `app/(app)/layout.tsx` (once, server-side) | Avoids a per-page duplicate `auth.getUser()`/`getUserNombre()` round trip; every route under `(app)` already funnels through this one layout. |
| Failure fallback for the name/email fetch | Same conservative-default pattern as `/profile/page.tsx`: `.catch()` → `nombre: null`, `email: user?.email ?? ''` | Consistent with existing precedent (`getUserPlan`/`getUserNombre` callers already do this); a read failure degrades the footer to icon+empty rather than crashing the shell for the whole authenticated app. |

## ADR check

No new ADR needed. Step 3 investigation found a fully reusable existing session mechanism (`lib/supabase/server.ts` + `client.ts`, `auth.getUser()`, `auth.signOut()`, `getUserNombre()`) already exercised by `/profile` and `danger-zone.tsx`. Nothing net-new is introduced at the session-management layer.

## Files to create / modify

| File | Change |
| --- | --- |
| `components/layout/sidebar-account.tsx` | ***NEW.*** Client component. Props: `{ email: string; nombre: string | null }`. Renders avatar (initial/UserIcon fallback), truncated name + email, and the logout button/handler. |
| `components/layout/sidebar.tsx` | ***MODIFY.*** Accept `{ email, nombre }` props, render `<SidebarAccount .../>` in a footer pinned with `mt-auto` below `<nav>`, divider via `border-background/10`. |
| `components/layout/app-shell.tsx` | ***MODIFY.*** Accept a `user: { email: string; nombre: string | null }` prop and forward it to `<Sidebar>`. |
| `app/(app)/layout.tsx` | ***MODIFY.*** Becomes an `async` Server Component; calls `createClient()` (server), `supabase.auth.getUser()`, `getUserNombre(supabase, user?.id)` (with the same `.catch()` fallback pattern as `/profile/page.tsx`), passes `user={{ email, nombre }}` into `<AppShell>`. |

No other files touched. No new routes, no new DB columns, no migration.

## AC → implementation step mapping

| # | Gherkin scenario (verbatim from FRESCO-82 comment) | Implementation step |
| --- | --- | --- |
| 1 | ***Ver los datos de mi cuenta en el pie de la barra lateral*** — logged in, open any screen, see name + email in the sidebar footer, see an avatar/initial identifying the active user | `app/(app)/layout.tsx` fetches `email`/`nombre` server-side once and passes them through `AppShell` → `Sidebar` → `SidebarAccount`, which renders the avatar (initial or `UserIcon` fallback) plus name and email text. Because `(app)/layout.tsx` wraps every authenticated route, this is visible on `menu`, `calendar`, `recipes`, and `profile` uniformly. |
| 2 | ***Cerrar sesión desde la barra lateral*** — from the account footer, select logout → session closes → redirected to the login screen | `SidebarAccount`'s logout button calls the local `handleLogout()`: `createClient()` (browser) → `client.auth.signOut()` → `router.push('/login')` — the same call sequence already verified working in `danger-zone.tsx`. |
| 3 | ***El componente no aparece sin sesión activa*** — on the login/signup screen, no account info or logout option is shown | Structural: `Sidebar`/`SidebarAccount` only render inside `app/(app)/layout.tsx`. `/login` and `/signup` are top-level routes outside the `(app)` group and never mount `AppShell`, so the footer never renders there — no extra guard code needed. |
| 4 | ***Mi nombre o correo son demasiado largos para el espacio disponible*** — long name/email truncates visually without breaking the sidebar layout, start of the text stays identifiable | `SidebarAccount`'s name/email text nodes get Tailwind `truncate` on a `min-w-0` flex container, so long values ellipsize at the end while the sidebar's fixed `w-64` width never grows. |

Business rule from the same story ("el componente solo se muestra cuando existe una sesión activa") is covered by the same structural argument as scenario 3.

## Review Workload Forecast

Estimated: 130 additions + 5 deletions = 135 total lines
400-line budget risk: Low
Chain strategy: stacked-to-main
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
