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

---

## 2026-07-27 — Stage 3 Code Review: FRESCO-5 + FRESCO-9, corrido retroactivo (solo-main)

**Qué**:
- Review corrido retroactivamente (commits ya estaban comiteados y pusheados a `main` antes de este pass, propio de `solo-main`). Lifecycle nativo `gentle-ai review` usado para bookkeeping del review: `review start` con `--base-ref` al commit previo a ambos tickets detectó 1542 líneas cambiadas, `risk_level: high`, sweep completo de 4 lentes (review-risk, review-resilience, review-readability, review-reliability) despachadas en paralelo.
- **4 findings legítimos arreglados** (commits nuevos, forward-only, sin tocar historia pusheada): (1) CRÍTICO — `handleGenerate` en onboarding sin `catch`, fallo de backend quedaba silencioso sin feedback al usuario; (2) MAJOR — `alergenos`/`ingredientes_odiados` sin validación server-side contra listas curadas (hueco tipo prompt-injection, causa raíz compartida FRESCO-5/FRESCO-9, arreglado extrayendo las listas a `lib/constants/dietary-options.ts`); (3) MENOR — `validateHousehold` no guardaba contra `NaN` en inputs vacíos; (4) WARNING — cero cobertura de test para `prompt.ts` (el system prompt de seguridad alimentaria), y la asunción de sesión previa de que "no hay test runner para `supabase/functions/**`" resultó **falsa** — `bun test` sí lo descubre y corre.
- **Findings legítimos pero declinados** (documentados en `review.md` de cada story, código no tocado): rama muerta ya razonada deliberadamente en el plan (Technical Decision 2 de FRESCO-5), fórmula duplicada `adultos+ninos` (abstracción prematura para 2 sitios), estilo de `toggleDieta`, gap real de AC-4 de FRESCO-9 (advertencia nunca llega al usuario porque `validator.ts`/`index.ts` fallan duro) — confirmado explícitamente Fuera de Alcance de FRESCO-9 en Jira, es territorio de FRESCO-7, ya trackeado en `dev-roadmap.md`.
- **Gotcha real del lifecycle nativo**: primer intento de `review start` usó scope de más (`87bf9cb..HEAD`, todo el trabajo de ambos tickets) en vez del delta real a pushear (`a158bac..HEAD`, ya que `a158bac` ya estaba en `origin/main` desde antes). El gate `pre-push` denegó con `scope-changed` porque el receipt no calzaba con lo que realmente se iba a pushear. Recalibrado con el `--base-ref` correcto (`a158bac`), re-corrido el lente (ahora `risk_level: medium`, 1 sola lente `review-reliability` — solo 328 líneas de fix), y `pre-push` dio `allow`. Lección: el scope del review nativo debe ser exactamente el delta que se va a pushear, no la ventana histórica completa del trabajo bajo revisión.
- `review.md` + Spec Compliance Matrix guardados en ambas carpetas story (`.context/PBI/epics/.../review.md`). `progress.md` de sesión actualizado con Phase 3 para ambos tickets.
- Verificación final: `bun test` 20/20, `lint:check`/`types:check`/`build` limpios.

**Por qué**: user pidió arrancar Stage 3 para FRESCO-5 y FRESCO-9 en paralelo; luego pidió revisar los findings y aplicar fixes, con recordatorio explícito de loguear cada interacción acá (confirmado: no hay regla en ningún CLAUDE.md que lo mande, es convención propia del archivo — igual se sigue).

**Siguiente**: push a `main` pendiente de confirmación explícita del user (Regla Crítica #4). Con `solo-main` sin rama de integración, el push ES el equivalente de merge+staging-deploy acá — Vercel autodeploya `fresco-pro.vercel.app` al pushear. AC-4 de FRESCO-5 (escritura real en DB) sigue pendiente de validar en vivo hasta que exista login real. FRESCO-7 (Menu Generation) sigue bloqueada, puede consumir `prompt.ts` tal cual apenas arranque.

---

## 2026-07-27 — Regla de bitácora formalizada + FRESCO-7 completo (Stage 1 a Stage 3)

**Qué**:
- **Regla de sesión formalizada**: user pidió escribir la convención "loguear resumen de sesión en bitácora.md" como regla explícita en los 4 sitios CLAUDE.md (global `~/.claude/CLAUDE.md`, `/fresco/CLAUDE.md`, `/fresco/AGENTS.md`, `fresco-app/CLAUDE.md`) para no depender de que el propio archivo se auto-recuerde. Confirmado antes: no existía tal regla en ningún CLAUDE.md previamente (solo convención auto-declarada en este archivo).
- **FRESCO-7 (Menu Generation) — ciclo completo Stage 1→3**:
  - Stage 1: plan armado (comment fallback en Jira, `implementation-plan-ready`, WIP), encontró 3 gaps reales más allá del brief: falta validación de presupuesto en `validator.ts` (100% prompt-trust), `semana_iso` mal pasado desde onboarding (mismo string que `fecha_inicio`, sin util ISO-week en el repo), `edge-functions.ts` tipando contra `types.ts` duplicado y viejo en vez de `@schemas`. Forecast: 810 líneas, riesgo High, `stacked-to-main`.
  - Stage 2, 3 batches + 1 cierre de gap: (1) fundación — util ISO-8601 week nueva, budget check server-side (buckets muy_bajo/bajo/medio/alto → 1.5/3/5/8€, confirmados por user), fix tipos; (2) `lib/api/meal-plan.ts` (lectura real) + wireado `/menu` (empty state, AlertBanner); (3) wireado `/calendar` (mismo patrón) — el propio subagente de batch 3 auditó contra el plan completo y encontró que faltaba diferenciar el error AC-4 (502 genérico) en onboarding — cerrado inline.
  - Stage 3: 4 lentes (risk/resilience/readability/reliability) vía `gentle-ai` nativo. **Hallazgo real importante**: resilience y reliability confirmaron independientemente un bug CRÍTICO que readability había descartado erróneamente en un chequeo lateral — `reshapeMenu()` nunca validaba que las 21 casillas existieran antes de devolver la grilla; un plan persistido parcial (alcanzable por el gap de transacción no-nativa ya documentado en `index.ts`) rompía `/menu`/`/calendar` en vez de caer al empty state — el propio fixture de test lo probaba (2-de-21 filas afirmado como "happy path"). Arreglado con guard de completitud. También: 502 ambiguo entre fallo genuino de Gemini y "no se pudo generar menú válido" (AC-4) — separado a 422 (mismo patrón que "catálogo insuficiente" ya usaba); logging agregado a catches silenciosos; empty-state duplicado extraído a componente compartido; 3 docs SRS/business quedaron diciendo 502 viejo, corregidos en la misma pasada.
- **Gotcha de la lifecycle nativa (recordado)**: al re-correr Stage 3 para FRESCO-7, el primer intento de `capture-result` falló por usar `--order` 1-indexed en vez de 0-indexed (flag real: "zero-based selected lens order") — corregido, confirmado en el `--help` real del binario.

**Por qué**: user pidió formalizar la regla de bitácora explícitamente ("créala en los 3... ahora 4 sitios") y continuar FRESCO-7 de punta a punta (Stage 1 a Stage 3), avisando en el medio que andaba corto de tokens — se ajustó el proceso (se saltó la ceremonia completa de 4 lentes en el batch 2 de implementación, review self-hecho más liviano) pero se retomó completo para el Stage 3 final.

**Siguiente**: FRESCO-7 dev-done, pusheado (`1049263..5546e39`). Sin más tickets hard-blocked de Master Sprint 0 Execution Sprint 1/2 según `dev-roadmap.md` al momento de escribir esto — recomendable re-consultar `dev-roadmap.md` pa'confirmar qué sigue.

---

## 2026-07-27 — Master Sprint 1 sembrado en Jira + gap de status Jira encontrado

**Qué**:
- `/product-management` corrido (Workflow B, 3x Phase 2B) — 3 épicas + 1 historia cada una: **FRESCO-10** (Calendario Editable) → **FRESCO-11** (reordenar menú arrastrando), **FRESCO-12** (Lista de la Compra) → **FRESCO-13** (generar + marcar comprado), **FRESCO-14** (Aprendizaje Cocinado/Descartado) → **FRESCO-15** (marcar plato cocinado/descartado). Mismo patrón que Master Sprint 0: AC/Scope/OOS/Business Rules vía comment fallback en español, `Blocks` contra FRESCO-7 (las 3 nuevas historias dependen de que exista un `meal_plan_recipes` persistido). Sin overlap de scope entre las 3.
- **Gotcha real de `acli` reproducido**: primer intento de link `FRESCO-11 Blocks FRESCO-7` salió en dirección invertida (el gotcha documentado de `--out`/`--in` para `Blocks` en este workspace específico) — detectado por verificación post-link (no confiar en el eco del comando), corregido, repetido para los otros 2.
- `.context/dev-roadmap.md` regenerado vía `/dev-roadmap`: nueva **Execution Sprint 3** (FRESCO-11/13/15, bloqueada solo por FRESCO-7, paralela entre sí). `epic-tree.md` refrescado.
- **Gap real encontrado de paso**: FRESCO-5, FRESCO-7, FRESCO-9 seguían con status Jira `WIP` a pesar de estar dev-done, revisados y pusheados hace rato — nadie los transicionó nunca (Stage 4 de `/sprint-development` asume merge-to-staging dispara la transición automática, pero acá es `solo-main` sin rama de integración, así que la transición automática nunca tuvo gatillo). Corregido: transicionados a `Control de calidad` (status real detrás del slug `ready_for_qa` en este workspace — coincide por casualidad con el mismo status que `story_default`/shift-left-QA usa, un solo status cubre ambos significados acá).
- **No resuelto, de baja prioridad**: intenté desasignar esas 3 historias de Basi Montes (regla del skill: no dejar asignado al dev en Ready-For-QA, dejar sin asignar si no hay QA persona distinta — proyecto es solo yo) — `acli workitem edit --assignee ""` reportó éxito pero el assignee no cambió (mismo tipo de gotcha silencioso que el skill ya documenta para edición de assignee vía acli, aunque en la dirección opuesta: acá no desasignó en vez de desasignar-quien-no-debía). No insistí más, es cosmético, no bloquea nada.

**Por qué**: user pidió sembrar Master Sprint 1 ("hay una ruta, lo vamos a conseguir") apenas Master Sprint 0 quedó completo.

**Siguiente**: FRESCO-11/13/15 bloqueadas hasta que FRESCO-7 se marque Done en Jira (ya está dev-done en los hechos, status Jira dice `Control de calidad`). Nada más es dev-ready todavía — hay que esperar a que FRESCO-7 cierre el ciclo QA/Done antes de arrancar Execution Sprint 3.

---

## 2026-07-27 — FRESCO-7 marcado Done manualmente (sin QA humana real posible todavía)

**Qué**:
- User preguntó si estábamos bloqueados hasta "probar" FRESCO-7. Respuesta honesta: el código ya está dev-done, revisado (4 lentes), tests automáticos verdes — lo único que falta es una caminata E2E real en navegador, imposible hoy porque **no existe login en toda la app** (Guest Mode/Progressive Signup ni sembrado, Master Sprint 2). No es un problema específico de FRESCO-7, es un gap más grande y anterior.
- Proyecto es solo user + IA, no hay QA persona distinta. User confirmó: transicionar FRESCO-7 a `Finalizada` (Done) a mano pa'desbloquear Execution Sprint 3, en vez de dejarlo colgado esperando un paso de QA que nadie va a hacer hasta que exista login.
- Transicionado vía `acli` (`Control de calidad` → `Finalizada`, status literal correcto en este workspace — "Done" a secas no existía como transición válida). Sincronizado.
- `.context/dev-roadmap.md` §1: la línea de "decision rule" tenía un ejemplo point-in-time ("FRESCO-7 is already WIP") que ya había quedado obsoleto el mismo día que se escribió — reescrita para no congelar estado nunca más, más una nota explícita de "proyecto solo" justificando este tipo de decisión manual.

**Por qué**: evitar que el roadmap quede permanentemente trabado detrás de un paso de QA que estructuralmente no puede ejecutarse todavía (sin auth), en un proyecto de una sola persona.

**Siguiente**: Execution Sprint 3 (FRESCO-11/13/15) dev-ready ahora. Recordar: la deuda de "caminar E2E de verdad" (FRESCO-5→7→11/13/15 completo) sigue pendiente y se paga cuando exista Guest Mode/login real (Master Sprint 2, todavía no sembrado).

---

## 2026-07-27 — FRESCO-11 Stage 1 + Stage 2 batch 1 (fundación del swap)

**Qué**:
- Stage 1: plan armado y pusheado a Jira, sincronizado. Encontró que un swap ingenuo de posición (drag & drop) podía corromper los contadores de aprendizaje de FRESCO-9/ADR-0001 (`veces_cocinada`/`veces_descartada`/`rating_promedio`, la data que fija precio Pro) si el trigger dispara mal — cualquiera de las dos formas obvias de hacer el swap (solo `recipe_id`, o el bundle completo con el trigger prendido) rompe algo. Promovido a **ADR-0002** (aprobada por el user).
- Stage 2 batch 1 (de 3): migración SQL nueva — función `swap_meal_plan_slots()` `security definer` que desactiva/reactiva el trigger de aprendizaje dentro de la misma transacción (nunca queda apagado si algo falla a mitad de camino, `ALTER TABLE ... TRIGGER` es DDL transaccional en Postgres). Extensión aditiva de `lib/api/meal-plan.ts` (`slotIds` + wrapper `swapMealPlanSlots()`).
- Review de seguridad (dispatchado con lente de riesgo dedicado, no el genérico que la lifecycle nativa hubiera elegido — el diff tocaba una función `security definer` nueva): chequeo de ownership cubre ambos slots antes de cualquier mutación, `search_path` pineado, GRANT/REVOKE ausente pero mismo gap ya aceptado/documentado para otras funciones (bitácora 26 jul), disable/enable del trigger confirmado transaccional de verdad (rollback completo si algo falla a mitad de camino). **1 finding no crítico**: `ALTER TABLE ... DISABLE/ENABLE TRIGGER` toma lock a nivel de tabla completa mientras corre el swap — otros usuarios escribiendo en `meal_plan_recipes` (aunque sea otro plan) esperan hasta que termine. Bajo impacto a esta escala (app hogareña, transacciones cortas). No arreglado — ADR-0002 ya rechazó la alternativa (GUC de sesión) por otras razones, cambiar el mecanismo ahora contradiría la ADR aceptada. Documentado como seguimiento, no bloqueante.
- Migración **no aplicada** — no hay Supabase local corriendo en esta máquina (Docker no disponible). Queda para revisión/aplicación manual del user antes de que el RPC funcione de verdad contra la DB real.

**Por qué**: user pidió arrancar Execution Sprint 3, empezando por FRESCO-11 (Calendario).

**Siguiente**: batch 2 (drag-and-drop UI real — `@dnd-kit/core`, componente `CalendarGrid`) y batch 3 (wiring final) quedan pendientes. **Antes de eso**: aplicar la migración `20260727000000_add_swap_meal_plan_slots_function.sql` contra Supabase real (local o remoto) — sin eso el RPC no existe todavía del lado servidor. User se va unas horas, retomamos después.

---

## 2026-07-29 — FRESCO-11 batch 2: drag-and-drop real + bug crítico encontrado y arreglado

**Qué**:
- `@dnd-kit/core` instalado (v6.3.1), compatibilidad con React 19/Next 16 verificada antes de instalar. Helper puro `applySlotSwap()` (swap de grilla, auto-inverso) + componente `CalendarGrid` (drag-and-drop real, todavía standalone, sin wirear a ninguna página).
- **Bug real CRÍTICO encontrado en review Stage 3**, confirmado por 2 lentes independientes (resilience + reliability): sin guard contra drags superpuestos — un segundo drag reusando un slot de un swap anterior sin resolver corrompía la grilla (el revert del primero pisaba mal el estado del segundo), sin nada que resincronizara después. Todavía no alcanzable en vivo (componente sin wirear), pero bug real latente. Arreglado: set `pendingSlots` deshabilita ambos extremos de un swap en vuelo hasta que resuelve — la carrera queda estructuralmente imposible, no solo mitigada.
- También arreglado: logging silencioso en fallo de RPC (agregado `console.error`, mismo patrón que `/menu`/`/calendar`), 2 tests que faltaban (self-swap no-op, referencia intacta de día no tocado).
- Declinado: pulido UX de drag por teclado (sin AC que lo exija), nit de nombres cosmético.

**Por qué**: user pidió seguir con batch 2 de FRESCO-11.

**Siguiente**: batch 3 (final) — wirear `CalendarGrid` a `/calendar/page.tsx` real, pase de live-UI con Playwright (empty/happy/error), y aplicar la migración pendiente antes de que el RPC funcione contra una DB real.

---

## 2026-07-29 — FRESCO-11 batch 3: wireado a `/calendar` real — Stage 2 completo

**Qué**:
- `/calendar/page.tsx` ahora usa `CalendarGrid` real en vez de la grilla estática — markup muerto (`DIA_LABELS`, `SLOTS`, el `.map()` manual, el ícono `GripVertical` suelto) eliminado. Empty state y banner de `advertencias` intactos.
- Review (reliability, sin findings): contrato de tipos entre `plan.menu`/`plan.slotIds` y `CalendarGridProps` confirmado sin cast, sin código muerto, sin regresión.
- Live-UI: empty state de `/calendar` verificado con Playwright. Drag-and-drop real y banner de advertencias NO verificables — sigue sin existir login en la app (deuda ya conocida, "camino E2E de verdad").
- **FRESCO-11 Stage 2 completo** — los 6 pasos del plan, en 3 batches. Queda: aplicar la migración a una DB real (bloqueado, sin Supabase local) y el camino E2E completo cuando exista login.
- User preguntó cuándo puede empezar a probar cosas manualmente — le ofrecí camino rápido (aparte de Guest Mode/Master Sprint 2): aplicar migraciones a Supabase real + crear usuario de prueba directo (saltando `/signup`, que sigue siendo shell vacío), para poder loguearse manual y probar onboarding→menú→calendario end-to-end ya. Pendiente de confirmación del user.

**Por qué**: user pidió seguir con batch 3 de FRESCO-11.

**Siguiente**: FRESCO-11 dev-done (falta aplicar migración + marcar Done en Jira, mismo patrón que FRESCO-7). Sigue FRESCO-13 (Lista de la Compra) y FRESCO-15 (Aprendizaje) de Execution Sprint 3. Ofrecido al user: aplicar migraciones + crear usuario de prueba para desbloquear testeo manual ya, antes de Guest Mode.

---

## 2026-07-29 — Login mínimo cableado + bug real de GRANTs encontrado en vivo

**Qué**:
- User quería empezar a probar la app, se atascó tratando de loguear (otra sesión había prometido un usuario de prueba y no llegó a crearlo). Diagnóstico: 2 migraciones nunca aplicadas contra la DB real (`create_recipe_learning_trigger`, `add_swap_meal_plan_slots_function` — `list_migrations` vía MCP mostraba solo 4 de las 6 que existen en el repo) y 0 filas en `auth.users`.
- Aplicadas ambas migraciones pendientes. Usuario de prueba creado directo por SQL (`auth.users` + `auth.identities`, password hasheado con `pgcrypto`, `email_confirmed_at` seteado a mano) porque el signup vía API REST rebotó `email_address_invalid` en dominios `.test`/`example.com` y luego `over_email_send_rate_limit` en un dominio real — bypassear el envío de mail fue más simple que pelear el rate limit. Verificado con `POST /auth/v1/token?grant_type=password`: login real, 200, token devuelto.
- Encontrado que `/signup` era shell puro (form sin `onSubmit`) y `/login` no existía en absoluto — ninguna ruta de auth funcional en toda la app, sin middleware. User eligió (vía pregunta con 3 opciones) el parche mínimo en vez de la historia formal de Guest Mode (Master Sprint 2): cableado real `signUp()`/`signInWithPassword()` en `/signup` y `/login` nuevo (subagente `general-purpose`, siguiendo el patrón de `onboarding/page.tsx`), `types:check` limpio.
- **Bug real crítico encontrado al probar en vivo con Playwright**: login OK, redirect a `/menu` OK, pero `getMealPlanForWeek` tiraba `permission denied for table meal_plans`. Causa: las políticas RLS en `user_profiles`/`meal_plans`/`meal_plan_recipes`/`shopping_lists` estaban bien diseñadas (1:1 con los patrones de acceso de la app, confirmado vía `pg_policies`), pero **ninguna migración corrió nunca el `GRANT` de tabla para el rol `authenticated`** — solo `recipes` lo tenía (su SELECT público de catálogo). Sin el GRANT de base, RLS es irrelevante: cualquier usuario autenticado real chocaba con permission denied en las 4 tablas centrales de la app, sin importar ownership. Corregido con migración nueva (`20260729120000_grant_authenticated_table_privileges.sql`), aplicada y verificada — recarga de `/menu` quedó en 0 errores de consola.
- Commiteado y pusheado a `main` (`f3edcfb`): `app/login/page.tsx` (nuevo), `app/signup/page.tsx` (wireado), la migración de grants.

**Por qué**: desbloquear testeo manual real del user (login→onboarding→menú→calendario) sin esperar a Guest Mode/Master Sprint 2, que sigue sin sembrar. El bug de GRANTs era estructural y bloqueaba absolutamente cualquier cuenta real, no solo la de prueba — valía arreglarlo ya, no documentarlo como deuda.

**Siguiente**: usuario de prueba activo (`qa.fresco@local.test`, credenciales ya en `.env` del user como `LOCAL_USER_EMAIL`/`LOCAL_USER_PASSWORD`). Falta: caminar onboarding→menú→calendario completo con el user en vivo (todavía no verificado post-fix), y el mismo fix de GRANTs sirve también para cuando exista Guest Mode. Recordar que `fresco-pro.vercel.app` no tenía este código hasta este push — redeploy de Vercel lo recoge solo si el pipeline no requiere acción manual.

---

## 2026-07-29 — Menú generado end-to-end por primera vez: 3 bugs reales de infra encontrados y arreglados

**Qué**:
- User pidió confirmar si ya podía loguear normal y probar la app real. Al probar onboarding→generar menú aparecieron, en cadena, 3 bugs reales nunca antes ejecutados en vivo (todo el código detrás era correcto, nunca se había desplegado/probado contra servicios reales):
  1. **Edge Functions nunca deployadas** (`generate-meal-plan`, `generate-shopping-list`, `update-recipe-status`) — mismo patrón que las migraciones sin aplicar de la sesión anterior. Deployadas las 3 vía MCP. Gotcha real del bundler: rutas `../../../api/schemas/*.types.ts` (3 niveles fuera del directorio de la función) rompían el deploy con "internal error" genérico sin pista — solucionado inlineando los tipos necesarios directo en cada bundle de función en vez de importarlos del monorepo (los tipos de fuente en `supabase/functions/*` siguen importando de `api/schemas/` sin cambios; el inline es solo del artefacto deployado).
  2. **`handleGenerate()` en onboarding mandaba `accessToken: null` siempre**, hardcodeado, ignorando la sesión real del usuario logueado — 401 permanente. Arreglado: ahora lee `client.auth.getSession()`.
  3. **Modelo Gemini pineado (`gemini-1.5-flash`) fue eliminado por Google** — 404 real vía `ListModels`. Probado `gemini-2.5-flash` como reemplazo: rechazado en vivo ("no longer available to new users", key nueva). Repineado a `gemini-3.6-flash` (verificado con llamada real a `generateContent`). Efecto secundario real: el modelo nuevo es "thinking" — gasta cientos de tokens en razonamiento interno antes de la respuesta visible (confirmado: 241-283 `thoughtsTokenCount` en un prompt de 3 palabras) — `maxOutputTokens: 1024` (tuneado para el modelo viejo, sin thinking) moría de hambre antes de escribir el JSON real. Subido a 8192.
  4. **RLS de `public.recipes` solo listaba rol `anon`**, no `authenticated`, en la única policy de SELECT (`qual: true`, o sea intencionalmente pública, pero mal alcanzada). El GRANT de tabla para `authenticated` ya estaba bien (fix de la sesión anterior) pero RLS bloquea por rol nombrado en la policy, no por el GRANT — un usuario real podía generar su plan (la Edge Function lee `recipes` vía RPC security-definer, no afectado) pero nunca leerlo de vuelta en `/menu` (select embebido `recipes(*)` corre bajo el RLS del propio usuario). El guard de completitud de `reshapeMenu()` (de FRESCO-11 Stage 2) atrapó esto correctamente y cayó a empty state en vez de crashear — la migración de esta sesión arregla la causa real (`alter policy ... to anon, authenticated`).
- De paso, corregido: pills (`Tag`) sin respirar — `DESIGN.md` tenía el token `tag` en `spacing.1` (4.4px) sin padding vertical, único componente pill-shaped sin `spacing.2`/`spacing.3` como sus hermanos (botones, cards) — bump a `px-2 py-1` en token + componente.
- Verificado end-to-end real en Playwright: login → onboarding (3 pasos) → generación real vía Gemini → persistido → `/menu` renderiza el menú completo, con advertencias reales de la IA (recetas de tipo "comida" reusadas para desayuno/cena por catálogo insuficiente — señal correcta, no bug). Plan de prueba borrado de la DB después de verificar.
- Commiteado y pusheado a `main` en 2 tandas (`f3edcfb`/`a9157f5` del round anterior, `f6cde6a`/`11d10d2` de esta) — la segunda tanda necesitó un commit extra porque `supabase/.temp/` (creado por `supabase secrets set`, metadata de link sin secretos) rompía `prettier --check` en el pre-push hook; agregado a `.gitignore` y `.prettierignore`.

**Por qué**: user quería empezar a usar la app de verdad, no solo tests automáticos — cada bug de esta lista era invisible en review de código porque ninguno se había ejecutado nunca contra Supabase/Gemini reales (migraciones sin aplicar, funciones sin deployar, modelo sin probar en vivo, RLS sin probar con sesión real). El patrón se repite: código correcto en el repo, infraestructura real nunca verificada contra él.

**Siguiente**: camino E2E real (login→onboarding→menú) queda desbloqueado y confirmado funcionando. Falta: `generate-shopping-list` sigue con `prompt.ts` en TODO deliberado (out of scope, es tarea de `/sprint-development`) — deployada pero fallará 502 si se invoca hasta que se implemente. Recomendable, próxima sesión: probar calendario (drag-and-drop, FRESCO-11) y lista de compra en vivo con este mismo usuario de prueba, y considerar si vale la pena documentar el gotcha del bundler de `deploy_edge_function` (rutas `../../../`) en algún lado más visible para no repetirlo.

---

## 2026-07-29 — Calendario probado en vivo (real), lista de compra confirmada sin construir

**Qué**:
- Con el usuario de prueba ya logueado y un plan real generado, se probó `/calendar` con Playwright: drag-and-drop real (lunes↔martes desayuno), swap verificado persistido en DB vía `swap_meal_plan_slots` (no solo optimistic UI) — reload posterior confirma el cambio server-side.
- **Bug real encontrado al recargar la página**: mismatch de hidratación de React en cada carga de `/calendar` — `aria-describedby="DndDescribedBy-N"` de `@dnd-kit/core` distinto entre servidor y cliente. Causa: `DndContext` genera ese id con un contador interno de módulo (no `React.useId()`, que sí sería SSR-safe), así que servidor (contador fresco por request) y cliente (contador que persiste entre navegaciones/HMR) pueden desincronizarse. Gotcha documentado del propio `@dnd-kit`, con fix soportado: pasar un `id` explícito y estable al `DndContext`. Aplicado (`id="calendar-grid"`), verificado con 2 reloads seguidos sin error.
- `/shopping-list` inspeccionado: confirmado que sigue siendo 100% mock (`MOCK_SHOPPING_LIST` hardcodeado en el propio archivo, ver comentario de header ya existente) — nunca se conectó ni al RPC real ni a `generateShoppingList()`. No es un bug encontrado, es la historia FRESCO-13 sin empezar todavía; coincide con que `generate-shopping-list/prompt.ts` sigue siendo TODO deliberado.
- Commiteado y pusheado a `main` (`b88855c`).

**Por qué**: user pidió seguir probando la app real después de confirmar que el menú generaba bien — siguiente paso lógico del roadmap de Execution Sprint 3 (FRESCO-11 ya dev-done, FRESCO-13 pendiente).

**Siguiente**: FRESCO-11 (calendario) queda confirmado funcionando end-to-end en real, no solo en tests automáticos — candidato a marcar Done en Jira si no quedan otros gaps. FRESCO-13 (Lista de la Compra) sigue siendo el próximo trabajo real de implementación: falta tanto el prompt de Gemini (`buildShoppingSystemPrompt`/`buildShoppingUserPrompt`) como el wiring del frontend (`/shopping-list` page + `comprado` toggle vía RPC `security definer`, ambos documentados como TODO en el propio código).

---

## 2026-07-29 — Nuevo artefacto: `.context/qa/regression.feature`, registro único de escenarios de prueba

**Qué**:
- User propuso alojar todas las pruebas manuales (y futuras automatizadas con Playwright) en un solo documento Gherkin, en vez de quedar sueltas en el chat de cada sesión. Feedback dado antes de construir: las AC de cada historia YA son Gherkin (viven en `comments.md` de cada story vía fallback de Jira, no en un `acceptance-criteria.md` dedicado como sugería la documentación de §9 — corregido ahí mismo tras verificar el repo real), así que el nuevo fichero debía ser complementario (recorrido cruzando historias), no una segunda copia de las AC por tarjeta.
- Creado `.context/qa/regression.feature`: una sola `Característica`, escenarios agrupados por área (login/registro, onboarding+generación, calendario, lista de compra) con tags (`@verificado-manual-2026-07-29`, `@pendiente`, `@no-implementado`, `@edge-case`). Todo en español de España, con directiva `# language: es` de Gherkin (soporta `Dado/Cuando/Entonces/Y` nativos, no solo `Given/When/Then` traducidos a mano).
- Sembrado con todo lo verificado en vivo hoy (login, onboarding→generación con sus causísticas de catálogo insuficiente/422/409/404, calendario con el swap real y la regresión de RLS ya arreglada) más una sección final de "Notas de infraestructura" (comentario plano, no Gherkin ejecutable) con el checklist de causísticas reales encontradas hoy: migración sin aplicar, función sin deployar, GRANT sin policy de rol correcto, modelo de Gemini deprecado sin aviso.
- Documentado el artefacto en 2 sitios más, siguiendo el patrón ya existente en el repo (`.context/reports/README.md`, `.context/business/README.md`): `.context/qa/README.md` (propósito, convención de tags, ciclo de vida, cómo consumirlo) y un puntero nuevo en `CLAUDE.md` §4 "Key paths".
- Commiteado y pusheado a `main` (`e647e35`).

**Por qué**: user quería trazabilidad end-to-end del producto en un solo sitio, más allá de las AC sueltas por tarjeta de Jira, con vista a automatizar con Playwright (`playwright-bdd`/`cucumber-js`) sin tener que traducir la documentación a un formato nuevo cuando llegue ese momento — el Gherkin ya escrito hoy sería directamente el spec ejecutable.

**Siguiente**: mantener el fichero vivo — cada sesión de testeo en vivo nueva debería sumar escenario o mover un tag (`@pendiente`→`@verificado-manual-FECHA`, o `@no-implementado`→verificado cuando FRESCO-13 se construya). Cuando se decida automatizar de verdad, evaluar `playwright-bdd` vs `cucumber-js` como capa de step-definitions (ninguno instalado todavía, decisión pendiente para ese momento).

---

## 2026-07-29 — Primer test E2E automatizado: `playwright-bdd` ejecuta el Gherkin real

**Qué**:
- User pidió automatizar YA el primer escenario de `.context/qa/regression.feature` (login) con Playwright, indicando dónde quedaría. Dispatchado a subagente (multi-file write con lógica nueva: config + step definitions + deps).
- Instalado `@playwright/test` + `playwright-bdd` (devDependencies), Chromium descargado. `playwright.config.ts` nuevo en la raíz: `defineBddConfig` apunta directo a `.context/qa/regression.feature` (sin duplicar el fichero en `tests/`), `tags: '@login and not @edge-case'` para acotar a un solo escenario (el otro `@login` — credenciales incorrectas — no tiene steps todavía, `bddgen` fallaría si no se excluye).
- **Bloqueo real encontrado por el subagente**: mi propio fichero `.feature` tenía 3 escenarios (ninguno el de login) con steps envueltos en 2 líneas — Gherkin exige una línea por step, y `@cucumber/gherkin` parsea el documento COMPLETO antes de aplicar cualquier filtro de tags, así que un error de sintaxis en un escenario ajeno rompía la generación completa (`bddgen`, 0 tests generados, `bun run test:e2e` fallaba con "No tests found" sin pista clara). El subagente se detuvo correctamente en vez de bordear el bloqueo (regla explícita del brief) y reportó exacto qué 3 líneas rompían el parseo. Arreglado por mí directamente (join de líneas, cero cambio de contenido/wording) — no delegado, era mecánico y ya sabía exactamente qué tocar.
- **Segundo hallazgo real del subagente**: `bun run <script>` no propaga `.env` al binario hijo al que hace shell-out (confirmado empíricamente) — mismo gap que ya resolvían los scripts `claude`/`opencode` del propio `package.json`. En vez de inventar un patrón nuevo, `test:e2e` reusa el mismo (`bash -c 'set -a; . ./.env; set +a; exec playwright test'`).
- `tests/steps/login.steps.ts`: steps con regex exacto al texto Gherkin en español, credenciales leídas de `process.env.LOCAL_USER_EMAIL`/`LOCAL_USER_PASSWORD` (nunca hardcodeadas), assertion de sesión activa vía cookie real de Supabase (`sb-*-auth-token`, confirmado leyendo `lib/supabase/client.ts` que usa `@supabase/ssr`, no localStorage).
- Verificado por mí, independientemente del reporte del subagente: re-corrida real (`bun run test:e2e`) → `1 passed`, más `types:check` limpio.
- Escenario tageado `@automatizado` en el `.feature`, con comentario puntero a `tests/steps/login.steps.ts`. Commiteado y pusheado a `main` (`153cce9`).

**Por qué**: user quería la promesa hecha en `.context/qa/README.md` ("ideally via playwright-bdd... Gherkin text and executable test stay the same artifact") cumplida de verdad, no solo documentada — y ver dónde queda concretamente el test automatizado.

**Siguiente**: patrón ya sentado para automatizar el resto de escenarios `@pendiente`/`@verificado-manual` uno a uno — cada nuevo step file en `tests/steps/`, cada escenario nuevo sumado al `tags` filter de `playwright.config.ts` según se le escriban steps. Candidatos obvios siguientes: signup, onboarding→generación de menú (requiere datos más complejos, quizá conviene limpiar el `meal_plan` de prueba al final de cada corrida), calendario (drag-and-drop real con `@dnd-kit`, más difícil de automatizar con Playwright puro — investigar si necesita el `KeyboardSensor` en vez de simular pointer events).

---

## 2026-07-29 — Segundo escenario automatizado: signup, con mock de red en vez de Supabase real

**Qué**:
- User pidió automatizar el escenario de signup. Antes de delegarlo, verifiqué yo mismo (curl directo) que un signup real seguía sin ser viable para test repetible: dominio `.test` rechazado (`email_address_invalid`, mismo gotcha de la sesión de login real) y dominio real dispara envío de email de confirmación de verdad, con el rate limit bajo que ya pisamos antes — sin `service_role` key para limpiar las cuentas de prueba que quedarían acumuladas en `auth.users`.
- Pregunté al user con `AskUserQuestion`: mockear la llamada de red vs signup real con email único por corrida. Eligió mockear.
- Dispatchado a subagente con esa decisión ya tomada. Resultado: `tests/steps/signup.steps.ts` — el formulario y el código cliente real (`app/signup/page.tsx`) corren de verdad en el navegador, pero `page.route('**/auth/v1/signup', ...)` intercepta la llamada HTTP real; el test verifica que el request salió con el email/password correctos (eso prueba "se crea la cuenta" a nivel de wire) y responde con un payload simulado con la forma real de GoTrue (el subagente corrigió mi sugerencia inicial de forma anidada `{user, session}` tras leer `node_modules/@supabase/auth-js` — la respuesta real es plana, `access_token`/`refresh_token` al mismo nivel que `user`, no anidada; si no se corrige esto el cliente no parsea la respuesta).
- **Bug real encontrado por el subagente**: `bddgen` fallaba con "Can't guess test instance" porque el `test` custom (vía `base.extend()` para compartir estado entre steps) no estaba exportado — playwright-bdd detecta el test instance correcto escaneando exports de los ficheros de steps. Corregido exportándolo.
- **2 problemas de lint reales que el subagente no atrapó, encontrados al yo verificar independientemente**: `async ({}, use) =>` viola `no-empty-pattern` de ESLint, pero Playwright exige literalmente ese patrón de destructuring vacío (no un identificador cualquiera — lo probé cambiándolo a `_fixtures` y rompió el fixture parser de Playwright en tiempo de ejecución, no solo lint). Arreglado con `eslint-disable-next-line` puntual + comentario explicando por qué es necesario. También la interfaz `SignupCtx` y un cast de tipo usaban `;` como separador en vez de `,`/nada, contra la convención real del repo (confirmado grepeando otros ficheros) — corregido.
- Verificado por mí, independientemente: `bun run test:e2e` → 2 passed (login + signup), `lint:check` limpio, `types:check` limpio. Escenario tageado `@automatizado` con puntero a `tests/steps/signup.steps.ts`. `playwright.config.ts` amplía el filtro de tags a `(@login or @registro) and not @edge-case`.
- Commiteado y pusheado a `main` (`730da7b`).

**Por qué**: mismo patrón que el escenario anterior — automatizar de verdad, no solo documentar. Pero acá el camino feliz real (hit al backend real) no era seguro de automatizar sin gastar cuota de email o ensuciar la base — se optó por verificar el contrato cliente↔Supabase a nivel de red en vez de la integración real end-to-end, con la decisión hecha explícita al user en vez de asumida.

**Siguiente**: mismo patrón para seguir automatizando escenarios `@pendiente`/`@verificado-manual` uno a uno. Cuando llegue el turno de onboarding→generación de menú, decidir si también conviene mockear Gemini (evitar gasto real de tokens/dinero en cada corrida de test) o aceptar el costo por ser información de negocio más crítica de verificar en real — decisión similar a la de hoy, no asumir sin preguntar.

---

## 2026-07-31 — FRESCO-15 (Aprendizaje): marcar plato cocinado/descartado, vía `/sprint-development` Solo

**Qué**:
- User pidió seguir con FRESCO-15 (backlog real, Execution Sprint 3, desbloqueada). Invocado `/sprint-development` — user eligió modo **Solo** (todo inline, sin subagentes, sin ceremonia de Jira/PR) cuando se le preguntó, coherente con la estrategia `solo-main` del repo y con ser el único dev.
- Epic ya documentaba que el backend estaba completo (`update-recipe-status` deployado, trigger de aprendizaje en DB) — historia 100% frontend. Wireado en `/calendar` (no en `/menu` ni tarjeta de receta separada — matchea mejor el AC genérico "cualquier plato pendiente" sin duplicar pantalla).
- `lib/api/meal-plan.ts`: `estados` agregado como grid paralelo aditivo (mismo patrón que `slotIds` de FRESCO-11) — `/menu` no se toca. `lib/api/user-profile.ts`: `getUserPlan()` nuevo, default `'free'` si no hay perfil (no lanza error, es de bajo riesgo mostrar el aviso de más).
- `CalendarGrid`: cada slot pendiente gana 2 botones (✓/✕) que llaman `updateRecipeStatus()` con el token de sesión real; una vez marcado, terminal — badge en vez de botones, nunca vuelve a habilitarse. Banner Pro estático para usuarias Free.
- **2 bugs reales encontrados en vivo, ninguno atrapado por tests/lint/types**:
  1. Los botones nuevos, anidados dentro de la celda draggable completa, nunca disparaban `onClick` — el `PointerSensor` de `dnd-kit` capturaba el pointerdown como inicio de drag antes de que el click llegara (confirmado por el propio anunciador de accesibilidad de dnd-kit: "dropped over droppable area" en cada click). Arreglado con el patrón oficial de "drag handle": los listeners de arrastre ahora viven solo en el ícono de agarre, no en toda la celda.
  2. Al ancho real de columna de esta grilla (~120px, 7 columnas), poner el badge de estado AL LADO del nombre de receta colapsaba el wrapper `flex-1` del nombre a 0px de ancho, superponiendo el texto en vez de mostrarlo al lado — visible recién al mirar la captura real, no en el código. Arreglado apilando controles/badge DEBAJO de la fila del nombre en vez de al lado.
  3. Mientras verificaba el fix de drag-and-drop arrastré el mismo par de slots dos veces (antes y después del fix de hit-area) — se cancelaron entre sí (doble swap = identidad), lo cual casi me hizo pensar que el drag seguía roto. Verificado con SQL directo contra la DB real antes de concluir — no confiar solo en la captura de pantalla cuando hay ediciones intermedias.
- Verificado en vivo con Playwright: marcar cocinado + descartado, terminal-lock confirmado (botones desaparecen, no reaparecen tras reload), drag-and-drop sigue funcionando después del refactor del handle, banner Pro visible para el test user (Free). Unit tests extendidos (`meal-plan.test.ts`, `user-profile.test.ts`), `bun test` 49/49, `types:check`/`lint:check` limpios.
- Commiteado y pusheado directo a `main` (`556e84a`) — sin PR, sin transición de Jira (Solo mode).

**Por qué**: mismo patrón de toda la sesión — construir y verificar en real, no solo contra tests. El proyecto es solo-main / un solo dev, así que la ceremonia completa de PR + Jira transitions del skill agregaba fricción sin valor real para esta historia chica.

**Siguiente**: sumar los escenarios Gherkin de FRESCO-15 (marcar cocinado, marcar descartado, intentar re-marcar) a `.context/qa/regression.feature` — todavía no existen ahí — y automatizarlos con Playwright, tal como pidió el user a continuación.

---

## 2026-07-31 — 4 escenarios de FRESCO-15 sumados al `.feature` y automatizados

**Qué**:
- Sumados 4 escenarios nuevos a `.context/qa/regression.feature` bajo `@aprendizaje` (marcar cocinado, marcar descartado, terminal-lock tras reload, aviso Pro para Free) — no existían todavía, tomados de las AC reales de Jira (comments.md de FRESCO-15).
- Automatizados los 4 en `tests/steps/aprendizaje.steps.ts`. Decisión de diseño distinta a signup: acá SÍ se pega al backend real (no se mockea) — marcar un estado es una escritura barata sin rate limit, y el escenario de "sobrevive al reload" necesita una escritura real persistida para probar algo de verdad. Como el estado es terminal por diseño (un hueco marcado nunca vuelve a pendiente), el step "dado un plato pendiente" no hardcodea un hueco fijo — toma el primero que todavía muestre sus botones de marcar, así las corridas repetidas se auto-adaptan en vez de romperse cuando ese hueco puntual ya se usó.
- **2 bugs reales encontrados llegando a verde, ninguno obvio de entrada**:
  1. `signup.steps.ts` y el nuevo `aprendizaje.steps.ts` cada uno definía su propio `base.extend()` para compartir estado entre steps — dos `test` custom independientes rompen la resolución de `bddgen` ("Found 2 test instances, but they should extending each other"). Arreglado moviendo ambos a un `tests/fixtures.ts` compartido, cada uno con su propio nombre de fixture (`signupCtx`, `aprendizajeCtx`) en vez de que cada archivo sea dueño de su `test`.
  2. `fullyParallel: true` (default del proyecto) corrió 2 escenarios `@aprendizaje` en paralelo, ambos agarrando "el primer hueco pendiente" al mismo tiempo — un escenario marcó cocinado, otro marcó descartado sobre el MISMO hueco, y el propio chequeo post-reload de uno vio el resultado del otro. Real race condition, no flake — estos escenarios mutan el mismo plan de prueba real compartido, así que correrlos en paralelo es inherentemente inseguro. Arreglado con `workers: 1` para toda la suite (suite chica, no importa la velocidad todavía).
- Verificado: 6/6 tests pasan (login + signup + los 4 nuevos), `bun test` 49/49, `types:check`/`lint:check` limpios. Commiteado y pusheado a `main` (`47dce99`).

**Por qué**: user pidió automatizar después de construir FRESCO-15 — mismo patrón de cierre que login/signup, pero esta vez con una decisión de diseño distinta (backend real vs mock) justificada por lo barato/no-rate-limited que es esta escritura puntual, a diferencia de signup.

**Siguiente**: la suite de Playwright ya cubre 6 escenarios reales (login, signup, y los 4 de aprendizaje). Quedan `@pendiente`/`@no-implementado` en el `.feature`: casos de error de login/signup, onboarding→generación de menú completo, calendario con fallo de red, y toda la Lista de la Compra (sigue sin construir, FRESCO-13). Recordar: cada corrida de los tests de `@aprendizaje` consume huecos reales del plan de la semana actual del usuario de prueba — se auto-resetea la semana que viene cuando se genere un plan nuevo, pero si se corre muchas veces en la misma semana puede quedarse sin huecos pendientes (falla visible y clara, no silenciosa).

---

## 2026-07-31 — FRESCO-13 (Lista de la Compra): construida de punta a punta, vía `/sprint-development` Solo

**Qué**:
- User pidió seguir con FRESCO-13 "con mucho amor" — historia más grande que FRESCO-15: dos frentes reales (prompt de Gemini para clasificar por pasillo + wiring completo del frontend, ambos en TODO/mock).
- **Backend**: `generate-shopping-list/prompt.ts` escrito real (los 13 pasillos fijos + vocabulario de unidades de FR-4.2/FR-4.3, spec de `api-contracts.md` §2b — el doc original del founder no está en el repo, escrito directo contra la spec autoritativa). `maxOutputTokens` subido 2048→8192 preventivamente (misma hambruna de tokens de "thinking" que ya encontramos en FRESCO-11/generate-meal-plan, no esperé a redescubrirla acá).
- **Gap real encontrado**: `shopping_lists` nunca persistía el resumen (`coste_estimado_min/max`) — solo `items`. Un revisit después de generar no tenía costo que mostrar, contradiciendo el Alcance de la historia ("mostrar... el coste estimado"). Migración nueva agrega las 2 columnas; Edge Function actualizado para persistirlas; `getShoppingListForPlan()` las lee de vuelta.
- **Primera vez que se corrió `bun run db:types`** en este proyecto — regenerados los types reales de Supabase (`swap_meal_plan_slots`, `jsonb_set_comprado`, columnas nuevas). Esto sacó a la luz un bug real, latente desde el bootstrap: `eslint.config.js` ya tenía una entrada de ignore para el archivo de types generado, pero apuntaba a una ruta vieja (`src/types/supabase.ts`) que no existe en este proyecto — nunca se había corrido `db:types` antes, así que el desajuste nunca se notó. Corregido a la ruta real (`lib/supabase/types.ts`). De paso, sacado el cast-escape-hatch de `swapMealPlanSlots()` que el propio comentario del código ya pedía sacar una vez regenerados los types.
- **Frontend**: `/shopping-list` reescrito de cero — mismo patrón de 3 estados que `/menu`/`/calendar` (sin menú → empty state compartido; menú sin lista → `ShoppingListGenerator`; lista generada → `ShoppingListView` real). `lib/api/meal-plan.ts` gana `mealPlanId` (mismo patrón aditivo que `slotIds`/`estados`). `lib/api/shopping-list.ts` nuevo: lectura real + `toggleShoppingListItem()` vía el RPC `jsonb_set_comprado` (ya vivía en la migración original, nunca usado desde el frontend), con el mismo patrón optimista-con-revert que `CalendarGrid`.
- Verificado en vivo con Playwright: generada una lista real de 51 productos vía Gemini, agrupada correctamente por pasillo, con coste estimado real (65–95 EUR) persistido; marcado un producto como comprado, confirmado que sobrevive a un reload real.
- Escenarios de `.context/qa/regression.feature` actualizados: los 2 de Lista de la Compra pasan de `@no-implementado` a `@verificado-manual-2026-07-31`; sumados 2 nuevos `@pendiente` para los casos de error (409 lista duplicada, 422 consolidación vacía) que completan las AC de Jira pero no se verificaron en vivo todavía.
- Commiteado y pusheado a `main` en 3 commits (backend, frontend, `.feature`).

**Por qué**: mismo patrón de toda la sesión — plan corto, construir de verdad, verificar en vivo contra Gemini y la DB real, no solo contra tests. "Mucho amor" se tradujo en cerrar el gap real del coste estimado (no solo lo mínimo pedido) y en dejar los types de Supabase regenerados de verdad en vez de seguir arrastrando un cast de escape.

**Siguiente**: Execution Sprint 3 completo (FRESCO-11, FRESCO-13, FRESCO-15 los tres dev-done). Quedan pendientes en el `.feature`: los 2 casos de error de Lista de la Compra recién sumados, los edge-cases de login/signup, y automatizar lo que se construyó hoy si el user lo pide (no se pidió explícitamente esta vez, a diferencia de FRESCO-15).

---

## 2026-07-31 — Escenarios de FRESCO-13 automatizados: sin mock, backend real

**Qué**:
- User pidió automatizar los 2 escenarios de Lista de la Compra. Decisión de diseño distinta a signup/aprendizaje: acá NO se puede mockear la llamada de red, porque `ShoppingListGenerator` hace `router.refresh()` al generar (relee la DB real como fuente de verdad en vez de confiar en el payload del cliente) — un mock nunca hubiera dejado nada real para que ese refresh encontrara. Los 2 escenarios pegan al backend real (Gemini real, DB real).
- Reset de fixture: cada escenario borra la lista real existente del usuario de prueba vía `DELETE` directo a la REST API de Supabase antes de generar — la policy RLS (`shopping_delete_own`) ya permite al dueño borrar su propia fila, la app simplemente nunca expone un botón para eso. Así ningún escenario depende del efecto lateral del otro, ambos repetibles contra el único plan real que existe.
- **2 bugs reales encontrados llegando a verde**:
  1. PostgREST rechaza un `DELETE` sin filtro ("DELETE requires a WHERE clause") aunque RLS ya scope a las filas del que llama — encontrado corriendo el `curl` manual antes de asumir que el reset funcionaba. Arreglado con un filtro siempre-verdadero (`id=not.is.null`).
  2. La generación real de Gemini tardó hasta ~40 segundos en la práctica (más que los ~10-12s que había visto manualmente antes) — el timeout POR TEST de Playwright (30s default) cortaba el test antes de que mi propio `expect(...).toBeVisible({timeout: 60000})` llegara a resolver. Encontrado debuggeando en vivo con Playwright CLI en vez de seguir gastando corridas de Gemini a ciegas. Arreglado subiendo el timeout de proyecto a 90s.
- Verificado: 8/8 tests E2E pasan (los 6 de antes + los 2 nuevos), `bun test` 49/49, types/lint limpios. Escenarios tageados `@automatizado` con puntero a `tests/steps/shopping-list.steps.ts`.
- Commiteado y pusheado a `main` (`0b2716a`).

**Por qué**: cerrar el ciclo de automatización de Execution Sprint 3 completo. La decisión de "sin mock" no fue arbitraria — se derivó de leer cómo `ShoppingListGenerator` está armado (refresh-desde-servidor, no confiar en el payload), mismo nivel de cuidado que las decisiones de mock/no-mock anteriores.

**Siguiente**: los 6 escenarios automatizados de esta sesión (login, signup, cocinado, descartado, terminal-lock, aviso Pro) + los 2 de hoy (generar lista, marcar comprado) — 8 en total, todos verdes. Quedan `@pendiente` en el `.feature`: edge-cases de login/signup, onboarding→generación de menú, calendario con fallo de red, y los 2 casos de error de Lista de la Compra (409 duplicado, 422 consolidación vacía) recién sumados.

---

## 2026-07-31 — Verificado deploy de Vercel + desbloqueada la decisión de guest-auth (ADR-0003)

**Qué**:
- User pidió chequear que Vercel levantó los últimos pushes. `/vercel-cli` auto-cargado. Confirmado vía `vercel ls -m githubCommitSha=<HEAD>` + `vercel inspect --wait`: deploy `READY` en producción, alias `fresco-pro.vercel.app`, mismo commit que el HEAD real de `main`. Smoke-check en vivo de `/shopping-list` real en producción: mismos 51 productos, mismo "ajo" marcado comprado (misma DB que local, confirmado), sin mock, funcionando igual que en dev.
- User preguntó por la siguiente tarea. Repasado `master-implementation-plan.md`: Execution Sprint 3 completo, sigue **Master Sprint 2** (EPIC-6 Guest Mode + EPIC-7 Progressive Signup), bloqueado explícitamente por una decisión técnica no resuelta (no una historia de código) — ningún Edge Function acepta llamadas sin JWT de Supabase Auth, y ningún doc fuente especifica cómo un guest sin cuenta las haría.
- Recomendé **Supabase Anonymous Sign-in** como mecanismo. User confirmó ("Dale con Supabase Anonymous Sign-in").
- Investigado vía Context7 (docs reales, no memoria): `signInAnonymously()` da una sesión real con JWT real; `updateUser({email, password})` sube la cuenta anónima a permanente **preservando el mismo `user_id`** (dato de guest sobrevive el upgrade sin reasignación). Encontrado de paso un riesgo real: ese upgrade exige verificación de email — la misma fricción de rate-limit/validación de dominio que ya pisamos con signup normal esta sesión.
- Verificado en vivo contra el proyecto real: `external_anonymous_users_enabled` estaba en `false`. Habilitado vía la Management API de Supabase (`SUPABASE_ACCESS_TOKEN` ya vivía en `.env`, sin necesidad de tocar el dashboard) — confirmado con una llamada real de signup vacío: usuario anónimo real, `is_anonymous: true`, JWT real devuelto. Ese JWT es indistinguible de uno normal para `requireAuthenticatedUser()` — **cero cambios de código necesarios en los Edge Functions o RLS** para aceptar guests, todo ya funciona tal cual está escrito.
- Redactada **ADR-0003** (Accepted — aprobación explícita del user en el mismo intercambio), resolviendo el Discovery Gap #1 de `business-api-map.md` (el de mayor prioridad del mapa) y actualizando esa sección + §7 para apuntar a la resolución en vez de repetir el gap.
- Limpieza: borrado el usuario anónimo de prueba creado durante la verificación (no es fixture reutilizable como `qa.fresco@local.test`, era solo scaffolding de un solo uso).
- Commiteado y pusheado a `main` (`e8f98b3`).

**Por qué**: Master Sprint 2 llevaba bloqueado desde `/project-foundation` (26 de julio) por esta decisión exacta. Resolverla con verificación real contra la instancia de Supabase real (no solo leer docs) evita que la próxima sesión de `/sprint-development` para FRESCO-6/7 descubra a mitad de implementación que el mecanismo elegido no está habilitado o no funciona como se asume.

**Siguiente**: Master Sprint 2 ya se puede scopear en historias reales — próximo paso natural es `/product-management` o `/sprint-development` directo para FRESCO-6 (Guest Mode) y FRESCO-7 (Progressive Signup), citando ADR-0003. Recordar el riesgo de email al planificar FRESCO-7 (Stage 1) explícitamente, no asumir que el upgrade "simplemente funciona". `business-api-map.md` recomienda además re-trazar la Journey 1 (Guest Happy Path) como una 5ª journey real la próxima vez que se regenere ese mapa.

---

## 2026-07-31 — Master Sprint 2 sembrado en Jira: Modo Invitado + Registro Progresivo

**Qué**:
- User pidió `/product-management` para armar las historias de Guest Mode/Progressive Signup y "desbloquear el login". Antes de escribir nada, leí `.context/PBI/epic-tree.md` y descubrí que **FRESCO-6/FRESCO-7 ya existen** — son la épica+historia de Generación de Menú (completada), no relacionadas. Paré, se lo señalé al user y pregunté explícitamente si quería épicas nuevas sin tocar las FRESCO-6/7 reales. Confirmó: "Sí, esas nuevas, no toques FRESCO-6/7 reales".
- `/product-management` corrido (Workflow C, épica creation, 2x) — mismo patrón que Master Sprint 1: **FRESCO-16** (Modo Invitado) → **FRESCO-17** (Modo Invitado | Generar un menú sin crear cuenta, US 6.1), **FRESCO-18** (Registro Progresivo) → **FRESCO-19** (Registro Progresivo | Solicitar registro tras ver el menú generado, US 7.1). Contenido trazado a `mvp-scope.md` FR-6.1/6.2/7.1, `user-journeys.md` Jornada 1, y ADR-0003 (mecanismo de auth ya resuelto, upgrade preservando `user_id`, caso límite de email ya existente).
- Descubierto en vivo: los 4 custom fields (AC/Scope/OOS/Business Rules) **no están en la pantalla de creación de "Historia"** para este proyecto (`createmeta` confirmado — proyecto team-managed/simplified). Escribirlos vía `additionalAttributes` en `create` falla (primero "must be string" con ADF, luego "excede 255 caracteres" con string plano) — no es un problema de formato, el campo simplemente no está habilitado para ese tipo de incidencia. Fallback a comentario estructurado (`## <label>` + contenido), igual que Master Sprint 1 — confirma que esa elección de Master Sprint 1 no fue arbitraria, era la única vía que funciona en este workspace.
- Link `Blocks` creado entre FRESCO-17 y FRESCO-19 (FRESCO-17 bloquea a FRESCO-19 — el registro progresivo convierte una sesión de invitada que Modo Invitado tiene que crear primero) — confirmado explícitamente por el user antes de crearlo (I18), dirección verificada vía `link list --json` (`outwardIssueKey` == FRESCO-19 desde la perspectiva de FRESCO-17).
- `bun run jira:sync-issues pull --epic FRESCO-16` y `--epic FRESCO-18` — cache local materializada, `epic-tree.md` actualizado.

**Por qué**: el user quería desbloquear el login real de la app — el valor concreto vive en Modo Invitado (dejar entrar a una visitante sin cuenta), Registro Progresivo es su contraparte de conversión. Sembrar ambas épicas ahora deja el backlog listo para `/sprint-development` sin re-litigar el mecanismo de auth (ya resuelto en ADR-0003) ni la secuencia (ya fijada por el link).

**Siguiente**: `/sprint-development FRESCO-17` para implementar Modo Invitado primero (es el prerequisito real, tanto por Jira link como por lógica de producto). Al planificar FRESCO-19 (Stage 1), recordar el riesgo de fricción de verificación de email ya señalado en ADR-0003 — no asumir que `updateUser()` "simplemente funciona" en producción.

---

## 2026-07-31 — FRESCO-17 implementado: Modo Invitado desbloqueado de verdad

**Qué**:
- `/sprint-development FRESCO-17` corrido en modo Solo (elegido por el user, mismo patrón que FRESCO-11/13/15).
- Causa raíz real (no asumida): `handleGenerate()` en `app/onboarding/page.tsx` ya leía la sesión existente y la reenviaba al Edge Function — pero una visitante nueva no tenía ninguna sesión, así que la llamada salía sin token y el Edge Function devolvía 401. La landing (`/`) ya enrutaba a invitadas directo a `/onboarding` sin ninguna barrera (construido en FRESCO-6 original, antes de esta reestructuración de backlog) — la única pieza que faltaba de verdad era crear la sesión.
- Cambio: efecto al montar `/onboarding` que llama `signInAnonymously()` (ADR-0003) solo si no existe ya una sesión — así una usuaria recién registrada vía `/signup` (que ya tiene sesión real) no pisa una sesión de invitado por error. Sin cambios de Edge Function ni RLS.
- `types:check` y `lint:check` verdes. Validación en vivo con Playwright-cli (navegador limpio, sin cookies): onboarding completo de 3 pasos → generación real con Gemini → `/menu` con menú real de 21 comidas, sin ningún prompt de registro en todo el flujo. Cookie de sesión decodificada confirmó `is_anonymous: true` con JWT real.
- Auto-review (Solo): 2 hallazgos, ninguno bloqueante. (1) ventana de carrera teórica entre el efecto de montaje y la lectura de sesión en `handleGenerate` — descartada, el formulario de 3 pasos tarda mucho más que el round-trip de auth. (2) hallazgo ajeno al alcance: `/menu` mostró una tarjeta "Fresco aprendió" (aprendizaje Pro) para una invitada nueva sin historial — posible bug de EPIC-FRESCO-5, no tocado aquí, señalado al user.
- Commiteado y pusheado a `main` (`17d9977`). Jira FRESCO-17: `Control de calidad` → `WIP` (Stage 1) → `Finalizada` (terminal — este repo no tiene QA separado, per la nota de `dev-roadmap.md`, y la validación en vivo la hice yo mismo).

**Por qué**: era el pedido explícito del user ("Dale con /sprint-development FRESCO-17") y el prerequisito real de FRESCO-19 (Registro Progresivo) por el link `Blocks` ya creado.

**Siguiente**: `/sprint-development FRESCO-19` para Registro Progresivo — recordar el riesgo de verificación de email de ADR-0003 al planificarlo. Revisar por separado la tarjeta "Fresco aprendió" sospechosa en `/menu` (posible bug de EPIC-FRESCO-5, fuera del alcance de esta historia). `.context/dev-roadmap.md` sigue sin reflejar Master Sprint 2 — recomendable correr `/dev-roadmap` antes de seguir con más historias de esta épica.

---

## 2026-07-31 — FRESCO-19 implementado: Registro Progresivo cierra Master Sprint 2

**Qué**:
- `/sprint-development FRESCO-19` en modo Solo. Bloqueador (FRESCO-17) ya Finalizada, sin impedimento real.
- 3 gaps reales encontrados en Stage 1 (no asumidos): (1) `/menu` no tenía NINGÚN camino hacia `/signup` — cero CTA, aunque la copy de `/signup` ("Guarda tu menú") ya estaba escrita para este momento exacto. (2) `/signup` llamaba siempre `signUp()`, que para una invitada con sesión anónima activa es la llamada incorrecta — crearía un usuario nuevo sin relación, en vez de convertir la sesión existente preservando `user_id` (ADR-0003 exige `updateUser()`). (3) El caso límite de AC4 (email ya existente) implica mover filas entre `user_id` reales — sin primitiva nativa de "fusionar usuarios" en Supabase Auth, trabajo cross-cutting real, no una línea.
- Antes de codear el punto (3), se lo planteé al user como decisión real (no lo resolví en silencio): ¿reasignación completa ahora, o fallback seguro + historia aparte? Eligió fallback seguro ahora.
- Cambios: banner "Guardar mi menú" en `/menu` (solo para `is_anonymous`, sin tocar el card `insight` reservado para el moat de aprendizaje per DESIGN.md — usé borde manual en su lugar). `/signup` ahora detecta sesión anónima y llama `updateUser()`, con manejo explícito del código de error real `email_exists` (confirmado en `@supabase/auth-js`) mostrando mensaje claro + link a `/login`, nunca fallando en silencio.
- Validado en vivo con Playwright-cli: flujo invitada completo hasta `/menu` con banner visible; conversión probada contra el email real ya registrado del usuario de test del proyecto (dominio inválido de prueba descartado, `email_address_invalid` no relacionado) → disparó el 422 `email_exists` real, mensaje correcto renderizado. El branch feliz (email nuevo válido → 200) no se disparó para no gastar un envío de email real — mismo criterio de "mockear en vez de quemar signups reales" ya establecido para `@registro` esta sesión; declarado como gap honesto en `compliance-matrix.md`, no ocultado.
- Creado **FRESCO-20** (Tarea) trackeando la reasignación de datos real del caso límite, linkeado `Relates` a FRESCO-19.
- Commiteado y pusheado a `main` (`48b866c`). Jira FRESCO-19: `Control de calidad` → `WIP` → `Finalizada`.

**Por qué**: cerraba Master Sprint 2 completo (Guest Mode + Progressive Signup), el objetivo explícito del user desde el pedido original de "desbloquear el login".

**Siguiente**: Master Sprint 2 completo (FRESCO-16/17/18/19 Finalizadas, FRESCO-20 pendiente como tech-debt). Pendientes sueltos: (a) FRESCO-20 — diseñar la reasignación de datos cross-usuario antes de implementarla; (b) la tarjeta "Fresco aprendió" hardcodeada en `/menu` — posible bug de EPIC-FRESCO-5, señalado dos veces ya, no tocado; (c) correr `/dev-roadmap` para que refleje Master Sprint 2 (sigue diciendo "no sembrado en Jira").

---

## 2026-07-31 — Investigado y parcheado el bug de "Fresco aprendió"

**Qué**:
- User pidió revisar el bug de la tarjeta "Fresco aprendió" señalado dos veces antes. Investigación real, no asumida:
  - Confirmado: JSX 100% hardcodeado en `app/(app)/menu/page.tsx`, sin ninguna condición — se mostraba a cualquier usuaria (Free, Pro, invitada anónima con cero historial posible).
  - Causa raíz completa vía `FR-5.5`/`FR-5.6` (`functional-requirements.md`): la explicación real de aprendizaje SÍ se genera correctamente en `supabase/functions/generate-meal-plan/prompt.ts` (Pro + historial real, testeado) — pero cae en el array genérico `advertencias`, compartido sin discriminador con las advertencias de seguridad alimentaria (FR-2.10/FR-8.2), y solo se muestra vía `AlertBanner`. La tarjeta `card-insight` dedicada (pensada para esto en DESIGN.md) se quedó como mockup del scaffold inicial de `/project-bootstrap`, nunca conectada cuando FRESCO-7 wireó el resto de la página a datos reales.
  - Confirmado además: `EPIC-FRESCO-5` (FRESCO-14) sigue "Listo" — solo tiene sembrada su historia fundacional (FRESCO-15, US 5.1, el toggle). Las historias para US 5.2/5.3 (generación con historial + esta explicación) nunca se sembraron.
- Presentado el hallazgo completo al user antes de tocar código, con 3 opciones (fix mínimo + bug en Jira / solo reportar / construir la versión real ahora). Eligió fix mínimo + bug en Jira.
- Eliminada la tarjeta hardcodeada de `/menu` (con comentario explicando por qué, para que nadie la vuelva a poner como placeholder). Verificado en vivo (login con usuario de test real): `/menu` renderiza limpio, sin la tarjeta falsa, sin errores.
- Creado **FRESCO-21** (Error/Bug) documentando actual/expected/root cause completos, linkeado `Relates` a FRESCO-14. Transicionado a `Finalizada` (el síntoma agudo — contenido fabricado — está resuelto; el gap de feature completo queda documentado en el propio ticket para una futura historia).
- Commiteado y pusheado a `main` (`7eb27aa`).
- Feedback de sesión: el user rechazó una confirmación de commit+push a mitad de FRESCO-19 y pidió "Comit+push+bitacora" directo — guardado en memoria persistente: no volver a preguntar por cada commit una vez establecida la cadencia en la sesión.

**Por qué**: pedido explícito del user tras haber señalado el hallazgo dos veces sin actuar sobre él.

**Siguiente**: seedear vía `/product-management` la historia US 5.2/5.3 bajo EPIC-FRESCO-5 (FRESCO-14) cuando se retome esa épica — separar `advertencias` de seguridad vs explicación de aprendizaje en el Edge Function, gatear por `isPro`, implementar el upsell Free-tier (FR-5.6). Sigue pendiente correr `/dev-roadmap` (Master Sprint 2 aún no reflejado ahí). También noté que `epic-tree.md` local parece sobrescribirse en cada `pull --epic <KEY>` en vez de hacer upsert por épica (solo queda la última épica sincronizada) — vale la pena revisar `scripts/sync-jira-issues.ts` en algún momento, no es blocker hoy.

---

## 2026-07-31 — Sembrada FRESCO-22 (US 5.3), corregidas 2 suposiciones propias sobre el gap

**Qué**:
- `/product-management` (Workflow B, Level 1) para FRESCO-14, US 5.2/5.3 — pedido explícito tras el fix de FRESCO-21.
- Antes de sembrar nada, verifiqué el código en vez de asumir la spec, y encontré que había dicho 2 cosas mal en el mensaje anterior:
  1. **US 5.2 (FR-5.4, generación pesa historial Pro) ya está 100% implementada** — `generate-meal-plan/index.ts` deriva `isPro` server-side desde `user_profiles.plan` (no confía en el cliente), llama `get_recent_recipe_ids()` (RPC real), y el prompt pesa `veces_descartada`/`rating_promedio` con tests reales. Sin gap.
  2. **FR-5.6 (upsell Free-tier) también ya existe** — no en `/menu` sino en `/calendar` (`components/calendar/calendar-grid.tsx`, `learning_free_tier_notice`, construido en FRESCO-15). Dije que faltaba; estaba mal, se lo corregí al user.
- Presentado el hallazgo corregido al user antes de sembrar — confirmó sembrar solo el gap real: **FRESCO-22** ("Aprendizaje | Mostrar explicación visible cuando el menú se ajusta por historial Pro", FR-5.5). El gap real y único: el texto de explicación de Gemini ya se genera bien, pero cae mezclado sin discriminador en el mismo array `advertencias` que las advertencias de seguridad (FR-2.10/FR-8.2) — sin campo propio en el schema (`meal-plan.types.ts` solo tiene `advertencias: string[]`).
- AC/Scope/OOS/Business Rules vía comment fallback (mismo patrón que toda la sesión). Link `Blocks` FRESCO-15 → FRESCO-22 (necesita el historial real del toggle para tener algo que explicar) — confirmado explícitamente por el user antes de crearlo (I18), dirección verificada.
- Encontrado y corregido de paso un bug real del script de sync: `pull --epic <KEY>` sobrescribe TODO `epic-tree.md` en vez de hacer upsert por épica — quedaba mostrando solo la última épica sincronizada. Corrido `pull` sin scope para restaurar la cobertura completa (8 épicas, 9 historias, 1 defecto).
- Commiteado y pusheado a `main` (`75112fb`).

**Por qué**: cerrar el hallazgo del bug de FRESCO-21 con una historia real, sin inventar trabajo donde el código ya estaba hecho.

**Siguiente**: `/sprint-development FRESCO-22` cuando se retome — la decisión técnica de separar `advertencias` (seguridad) de la explicación de aprendizaje en schema/prompt queda para el Stage 1 de esa implementación, no resuelta aquí. Vale la pena reportar el bug de `pull --epic` a quien mantenga `scripts/sync-jira-issues.ts` (no es parte de este repo de producto, es del boilerplate).

---

## 2026-07-31 — FRESCO-22 implementado: Master Sprint EPIC-5 cierra la explicación real de aprendizaje

**Qué**:
- `/sprint-development FRESCO-22` en modo Solo. Bloqueador (FRESCO-15) confirmado dev-done en código (toggle + Edge Function existen, aunque Jira seguía en "Control de calidad" — este repo no tiene QA separado).
- Migración real aplicada al proyecto: `meal_plans.explicacion_aprendizaje` (text, nullable) — columna nueva, separada de `advertencias`.
- Edge Function `generate-meal-plan` actualizado: nueva sección de prompt `EXPLICACIÓN DE APRENDIZAJE` (antes mezclada dentro de ADVERTENCIAS), normalización de string vacío a `null` en `index.ts` (no en `validator.ts` — no es safety-critical), persistencia + respuesta. Desplegado vía MCP (versión 6) — mismo patrón de bundle `source/` + `_shared/` de despliegues previos.
- `api-contracts.types.ts`, `lib/api/meal-plan.ts` (tipo `MenuSemanalPersistido` + select + mapping), `lib/supabase/types.ts` regenerado.
- `/menu` ahora renderiza el `Card variant="insight"` real (uso legítimo del token reservado por DESIGN.md esta vez — dato Pro real, no el mockup que FRESCO-21 sacó) cuando `explicacionAprendizaje` no es null.
- Verificado en vivo de punta a punta, sin gastar una generación real innecesaria: flippeado temporalmente el usuario de test real a `plan='pro'`, usando su historial real ya existente de la semana pasada (cocinado/descartado de sesiones previas) para disparar `get_recent_recipe_ids()`. Llamada directa al Edge Function para la semana siguiente (evita el conflicto 409 con el plan real de esta semana) → `explicacion_aprendizaje` real, cálido, en primera persona plural, separado limpiamente de `advertencias`. Confirmado persistido + confirmado que el `select()` exacto que usa el cliente lo devuelve bien. Limpieza inmediata: plan revertido a `free`, fila de prueba borrada.
- No se verificó visualmente la tarjeta en el navegador real (requeriría falsear la fecha del sistema para caer en la semana futura de prueba) — gap declarado en `compliance-matrix.md`, mismo patrón que el gap de FRESCO-19.
- Commiteado y pusheado a `main` (`c0210ab`). Jira FRESCO-22: `Control de calidad` → `WIP` → `Finalizada`.

**Por qué**: cerrar el hallazgo completo de FRESCO-21 con la implementación real, no solo el fix mínimo de esconder el mockup.

**Siguiente**: Master Sprint EPIC-5 (Aprendizaje) queda con FR-5.4/5.5/5.6 todos resueltos de verdad. Pendiente suelto: `FRESCO-20` (reasignación de datos del conflicto de email en Registro Progresivo) sigue sin diseñar. Reportar aparte el bug de `pull --epic` en `scripts/sync-jira-issues.ts`.

---

## 2026-07-31 — FRESCO-20 implementado: primer uso de service role del proyecto, con luz verde explícita

**Qué**:
- `/sprint-development FRESCO-20` en modo Solo. Antes de codear, diseño completo presentado al user (mecanismo + por qué) porque esto cruza un límite nuevo: primer código del repo que usa service role + Auth Admin API para mover datos entre usuarios reales. User confirmó explícitamente antes de tocar nada.
- Redactada **ADR-0004** (Accepted) documentando la decisión: verificación de contraseña real de la cuenta destino (server-side, nunca confiando en el cliente) antes de cualquier movimiento, RPC `reassign_guest_data()` con `EXECUTE` revocado a `public/anon/authenticated` y otorgado solo a `service_role` — así ningún usuario normal puede invocarlo directo con ids arbitrarios y robar datos de otra cuenta real.
- Migración real aplicada: `reassign_guest_data(from_id, to_id)` — reasigna `meal_plans` salvo que la cuenta destino ya tenga plan para esa semana (`unique_user_semana` existente, gana el de la cuenta real), espeja en `shopping_lists`, borra el `user_profiles` huérfano (cascada limpia lo que quedó del conflicto).
- Nuevo Edge Function `reassign-guest-data` (4to del proyecto) + helper compartido `_shared/service-role-client.ts` (primero de su tipo). `/signup` ahora pide la contraseña de la cuenta existente inline en vez de solo linkear a `/login`.
- Verificado en vivo de punta a punta con casos reales, no solo el camino feliz: invitada nueva generó un menú real para la MISMA semana que ya tenía la cuenta de test real (para forzar el conflicto a propósito) → contraseña incorrecta → 401, nada cambia; contraseña correcta → 200, confirmado por SQL directo: perfil y usuario anónimo del invitado borrados, su plan conflictivo descartado (no sobrescribió el de la cuenta real), la cuenta real conserva exactamente su plan original. Confirmado también a nivel de permisos de Postgres que `EXECUTE` del RPC solo lo tiene `service_role`.
- 1 gap declarado: la UI nueva de `/signup` (campo de contraseña inline) no se probó clickeando en un navegador real — el chequeo de fondo (la parte de seguridad) sí se hizo exhaustivo con HTTP real.
- El primer intento de deploy del Edge Function falló genérico sin detalle; reintentado idéntico, funcionó (tratado como transitorio, no de código).
- Commiteado y pusheado a `main` (`c97dc45`). Jira FRESCO-20: `Listo` → `WIP` → `Finalizada`.

**Por qué**: cerraba el último gap nombrado desde ADR-0003 ("not treat the happy path as only path"), y el user quería la reasignación real, no solo el fallback seguro que ya tenía FRESCO-19.

**Siguiente**: Master Sprint 2 completo de punta a punta (FRESCO-16 a FRESCO-22, todo Finalizado). Sin pendientes sueltos de este sprint salvo: (a) probar la UI de `/signup` clickeando en vivo si se quiere cerrar ese gap declarado; (b) el bug de `pull --epic` en `scripts/sync-jira-issues.ts` sigue sin reportar.
