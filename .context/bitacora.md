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

---

## 2026-07-26 — Push a GitHub + fix deploy Vercel

**Qué**:
- 10 commits atómicos hechos (nada estaba comiteado desde el día 1, ni siquiera foundation/design/bootstrap). Hook pre-commit falló una vez por terminología "wave" residual en `master-implementation-plan.md` (no tocado en ese commit, chequeo global) — corregido antes de comitear, sin `--no-verify`.
- Remote `github.com/BasiMontes/fresco` tenía historia no relacionada (1 commit propio, "Initial commit", 23 jul, mismo boilerplate base pero snapshot distinto). Confirmado con user: force-push, remote no tenía nada que local no tuviera ya. Hook pre-push falló una vez (`REGISTRY.md` de skills desactualizado) — regenerado, comiteado, reintentado.
- **Deploy Vercel real estaba roto**, aunque mostraba "Ready": proyecto "fresco" (de 3 candidatos con nombre parecido — user confirmó este es el correcto, `frescoapp`/`fresco-app` son restos viejos, ignorar) tenía Framework Preset en "Other" (creado 24 jul, antes de existir código Next.js, nunca se re-detectó) → sitio daba 404 real. Corregido: `vercel project update --framework nextjs`. Redeploy → ahora 500 (env vars `NEXT_PUBLIC_SUPABASE_*` nunca pusheadas a Vercel). Agregadas a Production+Preview vía Supabase MCP (`get_project_url`/`get_publishable_keys`, sin tocar `.env` local). Redeploy final → 200 real, HTML servido, logs limpios.

**Por qué**: user pidió comitear todo y subir; "verificar deploy" no era retórico — estaba roto de verdad, no solo confirmar que "Ready" en el dashboard.

**Siguiente**: nada bloqueante. Proyecto Vercel correcto = "fresco" (`fresco-pro.vercel.app` = producción). Ignorar `frescoapp` y `fresco-app` en cualquier operación Vercel futura.

---

## 2026-07-26 — Merge landing mockup + fix visual bugs + gotcha env local

**Qué**:
- User pasó HTML standalone (`fresco_landing.html`, landing ya aprobada en contenido) — mockup con fuente/colores DE OTRO draft (Satoshi, gris azulado), no el DESIGN.md real (Caprasimo/Figtree, verde/naranja exacto sí coincide). Reconstruido como 10 componentes en `components/landing/` usando tokens/Button/Card reales, no el CSS del HTML. `app/page.tsx` reescrito componiendo todo, rutas reales a `/onboarding` y `/signup` preservadas.
- User reportó 2 bugs reales tras revisar deploy: (1) checkmark del menú se veía azul/desalineado — causa: el glifo Unicode "✓" texto plano, algunos browsers lo renderizan con color propio de emoji ignorando el CSS — cambiado a ícono `lucide-react` `Check`, inmune a eso. (2) tarjetas "Solo en Pro" (Semana 1/2/4) invisibles contra su fondo — causa: sección y tarjetas compartían el MISMO token `bg-surface` — corregido a `bg-background` en las no-destacadas.
- **Gotcha real de este dev local**: `bun run dev` tiraba 500 (`NEXT_PUBLIC_SUPABASE_URL` inválida) incluso con `.env` perfecto (verificado byte a byte, sin CRLF/BOM). Causa real: el perfil de shell del user (`.zshrc` o similar) exporta `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_JWT_SECRET`/`SUPABASE_SECRET_KEY` vacías GLOBALMENTE — Next.js/dotenv no pisa vars ya existentes en el proceso, así que la shell gana sobre `.env` aunque el archivo esté perfecto. Fix por sesión: `unset` esas vars ANTES de `bun run dev`, en el mismo comando (una shell nueva las re-trae). Fix permanente: user tiene que sacar esos `export` de su perfil de shell — no es algo que se arregle desde el repo.
- Deploy verificado con Playwright real (no solo curl) en `fresco-pro.vercel.app` — captura completa, todas las secciones ok, un solo botón naranja (regla DESIGN.md respetada).

**Por qué**: user quería fusionar dos landings que le gustaban, y feedback visual real sobre el resultado deployado.

**Siguiente**: nada bloqueante. Si vuelve el 500 en dev local sin razón aparente y `.env` se ve bien, sospechar primero del perfil de shell (`env | rg -i supabase` para confirmar), no del archivo del proyecto.

---

## 2026-07-26 — Seed backlog Jira: Master Sprint 0 (EPIC-1/2/8)

**Qué**:
- `/product-management` corrido, scope Master Sprint 0 nomás (Onboarding, Generación Menú IA, Seguridad Alimentaria) — EPIC-3/4/5/6/7 quedan para después, a propósito.
- 3 épicos + 3 historias creadas en Jira (FRESCO-4 a FRESCO-9), 1 historia por épico (no 1 por US — se pisarían en scope). AC en Gherkin, scope, out-of-scope, business rules — documentado a fondo por pedido explícito del user.
- **Bug real encontrado y arreglado**: `scripts/sync-jira-issues.ts` hardcodeaba el literal `Story` en 5 lugares (2 JQL, 3 comparaciones) en vez de leer `work_types.story.jira_issue_type` (`Historia` en este workspace en español) desde `.agents/jira-required.yaml` — el dato correcto YA estaba en config, el script no lo usaba. Por eso `pull --epic` traía "Stories synced: 0" siempre. Agregado helper `storyIssueTypeName()`, reemplazados los 5 sitios. Verificado: ahora sincroniza bien. Bug de alcance repo (afecta cualquier proyecto con Jira no-inglés), no solo esta sesión.
- **Gap real de config**: `.agents/jira-link-types.json` decía que el tipo "Dependencies" existía (id 10014) — no existe en este workspace, solo "Blocks" (ya documentado como sinónimo equivalente en `jira-required.yaml`, no fue degradación). Refrescado el catálogo con `bun run jira:sync-link-types`. Ojo con la dirección: `blocks.outward` = "blocks" (sujeto termina primero), lo opuesto a `dependencies.outward` = "depends on" — el subagente erró la dirección al primer intento, la detectó vía verificación real (no confiar en el eco de acli) y la corrigió.
- **Cambio de idioma pedido por user**: las 6 tarjetas se escribieron primero en inglés (regla CLAUDE.md #12, "artefactos de repo siempre inglés" incluye Jira). User pidió anular esa regla PARA JIRA específicamente, de forma permanente — no solo esta vez. Actualizado CLAUDE.md #12 con override de proyecto. Las 6 tarjetas reescritas en español in-place (mismos IDs de comment, no duplicados).
- `.context/dev-roadmap.md` poblado por primera vez: Execution Sprint 1 = Onboarding + Food Safety (en paralelo), Sprint 2 = Menu Generation (bloqueado por los dos). Cero ciclos.

**Por qué**: user pidió seguir con "lo que sigue del roadmap" — sin backlog en Jira, `/sprint-development` no tiene de dónde arrancar.

**Siguiente**: implementar FRESCO-5 (Onboarding) y FRESCO-9 (Food Safety) en paralelo vía `/sprint-development` (desbloqueadas ya), FRESCO-7 (Menu Generation) después de esas dos. Recordar: proyecto habla español en Jira de acá en adelante, inglés en todo lo demás (código/commits/PRs).

---

## 2026-07-26 — Sprint-dev kickoff: FRESCO-5 + FRESCO-9 Stage 1+2 en paralelo

**Qué**:
- `/sprint-development` arrancado en paralelo para FRESCO-5 (Onboarding) y FRESCO-9 (Food Safety) — Fase 0/0b confirmaron ambas desbloqueadas en `dev-roadmap.md`, sin ciclos.
- FRESCO-9 Stage 1: plan cubre 2 layers defense-in-depth (ADR-0001) — Layer 1 SQL pre-filter `get_filtered_recipes()` ya existía, Layer 2 system prompt Gemini era stub. Decisión user: completar las 5 categorías de reglas del prompt de una (no solo las 2 de food-safety), para no reabrir `prompt.ts` en FRESCO-7 después.
- FRESCO-9 Stage 2: `prompt.ts` reescrito completo (alérgenos/ingredientes odiados = exclusión dura, historial Pro/presupuesto/variedad = reglas soft best-effort), `components/ui/alert-banner.tsx` nuevo (`AlertBanner`, role="alert", token `warning`, no dismissible). Lint/types verdes.
- **Bloqueo real cross-ticket**: subagente de FRESCO-9 no pudo comitear en su primer intento — `.husky/pre-commit` corre `types:check` de TODO el repo, y en ese momento fallaba por errores de tipos de FRESCO-5 (en progreso en paralelo, archivos que a este agente le prohibí tocar). Correctamente NO bypaseó el hook, dejó diff limpio sin comitear, reportó bloqueo.
- FRESCO-5 Stage 2 terminó después (3 commits atómicos: store reestructurado con locks vegano→vegetariano, validación pura `validateHousehold`, pasos 1-3 onboarding + `upsertUserProfile`). `bun test` 10/10, lint/types/build verdes. Vocabularios de alérgenos/ingredientes sacados en vivo de Supabase (columnas reales `recipes`), no inventados.
- **Gap real encontrado (no tapado)**: AC-4 (escritura real en DB tras onboarding) no se pudo caminar en browser real — no existe página de login todavía (`/signup` es shell), y un intento de signup vía API chocó con `over_email_send_rate_limit` (429). Cubierto solo con unit tests (client mockeado). Queda pendiente validar en vivo cuando exista login real.
- Con FRESCO-5 comiteado y `types:check` repo-wide verde, reintenté comit de FRESCO-9 — ya estaba comiteado (el subagente lo reintentó y logró solo, commit `34310b2`, apenas destrabado el repo).

**Por qué**: user pidió arrancar FRESCO-5 y FRESCO-9 en paralelo, FRESCO-7 después.

**Siguiente**: Stage 3 (code review) para ambos tickets — estrategia es `solo-main` (PR opcional, push directo a main permitido). Falta: (a) decidir si review pasa por PR o inline+push directo; (b) validar AC-4 de FRESCO-5 en vivo apenas exista login; (c) FRESCO-7 (Menu Generation) queda para después, ya puede consumir `prompt.ts` tal cual (nota dejada en el archivo).
