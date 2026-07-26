# Bitácora — Fresco

Log append-only. Cada iteración relevante suma entrada abajo: qué hecho, por qué, qué sigue. IA lee esto primero para contexto rápido en sesión nueva — no re-derivar todo desde cero. Nunca reescribir entrada vieja, solo agregar.

Formato entrada: fecha — título corto. Qué / Por qué / Siguiente.

---

## 2026-07-25 — Project Foundation + Design System

**Qué**: `/project-foundation` corrido — PRD (executive-summary, mvp-scope, user-journeys, personas), SRS (architecture, api-contracts, functional/non-functional-requirements), business docs (business-model, market-context, domain-glossary, maps). `/design-system` corrido — `DESIGN.md` con tokens + 20 componentes.

**Por qué**: fundar constitución + arquitectura antes scaffolding real. Stack decidido: Next.js + Supabase + Vercel + Gemini Flash.

**Siguiente**: `/project-bootstrap`.

---

## 2026-07-25 — Project Bootstrap: base backend + frontend

**Qué**: schemas API (`api/schemas/*`), `api/config/env.ts`, páginas Next.js con mock data (`app/**`, `lib/mock/recipes.ts`), 3 Edge Functions (generate-meal-plan, generate-shopping-list, update-recipe-status) + auth compartido (`supabase/functions/_shared/{auth,supabase-client,...}.ts`), 3 migraciones SQL escritas (NO aplicadas todavía — a propósito, user revisa antes).

**Decisión user**: schema mixed-shape — `recipes` sigue JSONB (vivo, 35 filas seed), 4 tablas nuevas (user_profiles, meal_plans, meal_plan_recipes, shopping_lists) van typed-relational.

**Por qué**: seed inicial repo greenfield, sin `next`/`react`/`@supabase/supabase-js` todavía.

**Siguiente**: aplicar migraciones a Supabase real + wire cliente frontend.

---

## 2026-07-26 — Backend DB + Auth: migraciones aplicadas, cliente wireado

**Qué**:
- Ref proyecto real hallado vía `list_projects`: `jdqemhewjrjuopssdurn` (Fresco, eu-west-1). `.agents/project.yaml` tenía `db_project_ref` roto (basura de plantilla pegada al valor, ref equivocada) — corregido en `local` + `staging`.
- 3 migraciones locales revisadas (aditivas, RLS correcto) y aplicadas contra DB real (antes vacía, 0 migraciones).
- Error propio detectado al reenviar SQL: `get_filtered_recipes` quedó con `dieta_keto` apuntando a `'halal'` y perdió chequeo `dieta_halal` — corregido con 4ta migración, sincronizada a disco.
- Cliente Supabase frontend creado: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server, cookies async), `lib/supabase/types.ts` (generado desde schema real). Deps agregadas: `@supabase/supabase-js`, `@supabase/ssr`. Script `db:types` en `package.json`.
- `proxy.ts` creado en root — **hallazgo real**: Next.js 16 deprecó `middleware.ts`, renombrado a `proxy.ts` (función exportada también cambia nombre). Sin este archivo, sesión de Supabase nunca refresca cookie — `server.ts` depende de él explícitamente.
- Verificación: `bun run build`, `types:check`, `vars:check` — todo verde.

**Por qué**: user dio token nuevo de Supabase, pidió continuar bootstrap backend DB + auth.

**Siguiente** (no bloqueante, pendiente decisión user): hardening de funciones SECURITY DEFINER llamables por anon/authenticated vía RPC (handle_updated_at, rls_auto_enable, get_recent_recipe_ids, get_filtered_recipes, jsonb_set_comprado) — riesgo real bajo (jsonb_set_comprado ya tiene ownership check propio), pero exposición innecesaria. Guest-mode auth (FR-6.1) sigue TODO explícito — deferred a propósito, no resuelto por ningún doc fuente.

---

## 2026-07-26 — Security fix: policy de escritura en `recipes`

**Qué**: policy `"Solo administradores pueden escribir"` en `public.recipes` decía admin-only pero su expresión real era `USING(true)/WITH CHECK(true)` para rol `authenticated` — cualquier user firmado podía insertar/editar/borrar cualquier receta del catálogo compartido. Detectado por `get_advisors(security)` como `rls_policy_always_true`.

Sin concepto de admin en el schema (no `role` column, no tabla admin, no `is_admin()`) — no se inventó uno. Fix mínimo: policy borrada (migración `20260726010000`). Con RLS activo y sin policy de escritura permisiva, `authenticated` queda sin write access — coincide con lo que el nombre de la policy siempre dijo. Escritura real del catálogo sigue vía `service_role` (seed scripts), no afectada.

**Por qué**: advisor de seguridad post-migración lo marcó, user confirmó "arréglalo".

**Siguiente**: si algún día se necesita panel admin con write autenticado, diseñar chequeo real de rol ahí — nunca reponer `USING(true)`.
