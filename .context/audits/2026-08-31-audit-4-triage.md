# Auditoría 4 — triaje de los 71 hallazgos

> Informe completo: `.context/audits/2026-08-31-audit-4.html`
> Nota: 3,5 / 5 (desde 4,3 en la auditoría-3). Rúbrica v1, congelada.
> Este fichero es la lista accionable — checklist por olas de remediación.
> **En Jira: EPIC [FRESCO-359](https://basiliomontescastano.atlassian.net/browse/FRESCO-359)** — 41 tarjetas hijas FRESCO-360…400, etiquetadas `auditoria-4` + `ola-0/1/2/3` (= Sprint A/B/C/D). Cada tarjeta tiene un comentario con AC + esfuerzo + eje + rutas.

## Mapa hallazgo → tarjeta Jira

| Ola | Tarjetas | Cubre |
|---|---|---|
| 0 (Sprint A) | FRESCO-360 (B1) · 361 (B2) · 362 (H1+H2) · 363 (H8+H9) · 364 (L1+L2+L3) | los 2 BLOCKER técnicos + endurecer edge fns + auth + 3 fixes menores |
| 1 (Sprint B) | FRESCO-365 (B3) · 366 (B4) · 367 (H10) · 368 (H11) · 369 (H12) · 370 (H13+H16) · 371 (H14) · 372 (H15) · 373 (M27) · 374 (M24) · 375 (H4) · 376 (H7) · 377 (M12) · 378 (H17) · 379 (H18) | legal + instrumentación + producto + CI honesto + backfill |
| 2 (Sprint C) | FRESCO-380 (M1) · 381 (M2) · 382 (M4+M5+M8) · 383 (M6) · 384 (M7) · 385 (M9) · 386 (M10) · 387 (M13+M14+M15) · 388 (M16+M17+M18) · 389 (M21+M22, +ADR-0020 para M11) · 390 (M25) · 391 (M26) · 392 (forward-only §08) | correctitud del motor + verificación + backlog + ADRs + cerrar la deuda forward-only |
| 3 (Sprint D) | FRESCO-393 (M19+M23) · 394 (M20 + proceso §09) · 395 (L4+L5) · 396 (L6-L10) · 397 (L11+L12) · 398 (L13+L19+L20) · 399 (L14-L17) · 400 (L18+L21) | disciplina + congelar CI + los BAJO agrupados |

M11 (proyecto Supabase único) NO tiene tarjeta propia — diferido a Supabase Pro (FRESCO-328); solo el ADR-0020 dentro de FRESCO-389. FRESCO-330 (validación de producto) enlazado a la épica, no recreado. FRESCO-328/320 se reclasifican dentro de FRESCO-378.

---

## Sobre los números — léelo antes de la lista

La nota bajó **−0,8**. Descompuesto:

| Fuente del −0,8 | Peso | ¿Es regresión? |
|---|---|---|
| 2 BLOCKER técnicos (B1 pago, B2 alérgenos) | ~−0,4 | **No.** Deuda de julio/agosto, invisible a 3 auditorías + un code review. Nadie construyó el exploit ni trazó un alérgeno del input al plato. |
| Cierres *forward-only* (FRESCO-282/313/320/328) | ~−0,2 | **Parcial.** Los tickets dicen "Finalizada"; el problema sigue al ~90%. Esto sí es una lección de proceso. |
| Drift de docs + lente de producto + crítica de proceso | ~−0,2 | **No.** project-dev-guide.md con Gemini; funnel sin medir; la cinta de auditorías. |

Si quitas los 2 BLOCKER y el ajuste de los cierres forward-only, estás en **~4,1** — plano respecto a la auditoría-3. La ingeniería no empeoró; los 6 frentes lo dijeron por separado (Stripe sólido, DB endurecida, aislamiento e2e correcto, motor determinista como activo).

**Qué hace falta para volver a subir:** cerrar B1–B4 de verdad + los ~6 ALTO que tocan una cohorte. La próxima pasada vuelve por encima de 4. El resto (~55 hallazgos) es el backlog normal de cualquier proyecto real.

Leyenda esfuerzo: **XS** <1h · **S** ~medio día · **M** 1-2 días · **L** 3+ días.
Columna "Cohorte": ✋ = arréglalo antes de meter usuarios de pago.

---

## Ola 0 — Esta semana (bugs reales en producción)

- [ ] **A4-B1** · Bypass de pago — el trigger `protect_subscription_columns` es `BEFORE UPDATE`; el camino de `INSERT` está abierto. `signInAnonymously()` + `POST /rest/v1/user_profiles {plan:"pro"}` = Pro permanente para cualquiera. · Arquitectura/Seguridad · **S** · ✋✋
  - Fix: rama `BEFORE INSERT` en `prevent_client_subscription_writes()` + trigger a `BEFORE INSERT OR UPDATE`, o `REVOKE INSERT` + RPC `SECURITY DEFINER` con allowlist. Barrido `plan IN ('pro','family') AND stripe_subscription_id IS NULL` en el cron de reconciliación.
- [ ] **A4-B2** · Seguridad alimentaria sin red — `get_filtered_recipes` es el único enforcement; match sensible a mayúsculas; `alergenos_texto_libre` no lo lee nadie; vocabulario omite cacahuete/leche/soja/sésamo/crustáceos; 0 tests de comportamiento. · Arquitectura/Verificación · **M** · ✋✋
  - Fix: pgTAP o e2e que siembre perfil+receta con alérgeno y asserte ausencia, y gatear sobre él · CHECK de conformidad en `recipes.alergenos` + `lower()` en el filtro · decidir qué hace `*_texto_libre` (parsear vs bloquear honesto) · borrar el comentario de la "Layer 2".
- [ ] **A4-H1** · `update-recipe-status`: la sustitución aplica `nueva_recipe_id` sin validar estado ni alérgeno; corrompe agregados globales sin rate limit. · Arquitectura · **S** · ✋
- [ ] **A4-H2** · `reassign_guest_data` mueve `meal_plans` a la cuenta destino sin re-filtrar contra su perfil de alérgenos. · Arquitectura · **S** · ✋
- [ ] **A4-H8** · Leaked-password protection desactivada en el proyecto hosted; `config.toml` min length 6. · Seguridad · **XS** · ✋
- [ ] **A4-H9** · `rate_limit_exempt_users` contiene 4 UUID de cuentas de prod cuyas credenciales están en `.env` / secretos CI / épica enlazada desde `/qa` pública → generación ilimitada. · Arquitectura/Seguridad · **S** · ✋
- [x] **A4-H19** · El rastro de auditoría reporta mal la nota de la auditoría-3 (3,7 vs 4,3 real). · Disciplina · **XS** · — · **HECHO** (README + MEMORY corregidos esta sesión).

---

## Ola 1 — Antes de la primera cohorte de pago

### Producto
- [ ] **A4-B3** · Banner legal "Borrador" + `[nombre legal y NIF/CIF pendientes]` vivos en `fresco-pro`. No es tarea de ingeniería — necesita revisión de abogado. · **S** · ✋✋
- [ ] **A4-B4** · La métrica del MVP no es medible: sin eventos trial→pago / renovación / cancelación; sin person-property `plan` en PostHog; funnel sin instrumentar (6 eventos, 5 sin propiedades). · Producto/Verificación · **M** · ✋✋
  - Fix: eventos servidor `trial_started` / `trial_converted_to_paid` / `subscription_renewed` / `subscription_cancelled` · `plan`/`is_guest`/`signup_method` como person properties en `identify` · `semana_iso`+tier en `MENU_GENERATION_COMPLETED` · las 15 etapas de funnel que faltan · reverse-proxy `/ingest`.
- [ ] **A4-H10** · La lista de la compra es una generación manual aparte en otra pantalla; 2 de 38 planes la tienen. El PRD dice "automática". · Producto · **M** · ✋
- [ ] **A4-H11** · Landing vende "Menús ilimitados" e "Historial de menús" como Pro; ninguno gateado en código (Free y Pro tienen el mismo límite). · Producto · **S** (arreglar copy) / **M** (gatear) · ✋
- [ ] **A4-H12** · El moat no da payoff hasta la semana 2 y exige haber usado un toggle de 16px en la semana 1; Free nunca lo ve. Sin puente para las 2 primeras semanas. · Producto · **M** · ✋
- [ ] **A4-H13** · Marketing "Menú semanal con IA" / "a diferencia de ChatGPT" sobre un motor 100% determinista sin IA. · Producto · **XS** (copy) · ✋
- [ ] **A4-H14** · Onboarding de 4 pasos con presupuesto obligatorio vs requisito duro del PRD "solo 3 pasos". · Producto/Fundación · **S** · ✋
- [ ] **A4-H16** · "Tu impacto": cifras inventadas ("~300€ menos", "25% menos desperdicio") presentadas como investigadas; el código hermano admite que no hay fuente. · Producto/Fundación · **XS** · ✋
- [ ] **A4-H15** · Loop de re-enganche solo push, opt-in enterrado en `/profile` (0 suscripciones), envío sin instrumentar, copy rioplatense. · Producto · **M** · (deseable pre-cohorte)
- [ ] **A4-M27** · Toggle cocinado/descartado = icono de 16px, abajo a la derecha, e irreversible. La única interacción de la que depende el tier de pago. · Producto/Moat · **S** · ✋
- [ ] **A4-M24** · Invitados se `identify()`'an sin marcador; `USER_SIGNED_UP{method:'guest'}` infla signups; sin reverse proxy (15-30% de pérdida a ad-blockers sobre 10 personas). · Producto/Analytics · **S** · ✋
- [ ] **A4-M25** · Conversión de registro progresivo depende de OTP por remitente Gmail SMTP. · Producto · **S** · (deseable pre-cohorte)
- [ ] **A4-M26** · Catálogo: 717/1000 con foto (5 conteos distintos en los docs); 228 con dificultad en blanco. · Producto · **M** · (deseable)

### Tests / CI (honestidad del pipeline)
- [ ] **A4-H4** · `supabase/functions/` excluido de `tsc` + ESLint + sin `deno check` en CI. Un error de tipos en `generate-meal-plan/index.ts` pasa `repo:check` verde. · Verificación · **S** · ✋
- [ ] **A4-H7** · CI (PR e2e + post-deploy-smoke) usa secretos de Stripe/PostHog/Sentry de producción; filtra objetos Stripe sin limpiar, contamina analytics y alertas. · Verificación/Seguridad · **S** · ✋
- [ ] **A4-H5** · Ningún handler `index.ts` de Edge Function tiene test unitario (incluidos `reassign-guest-data`, `delete-account`, `update-recipe-status`). · Verificación · **M** · (deseable)
- [ ] **A4-H6** · Cobertura no se mide en ningún sitio. · Verificación · **XS** · (deseable)
- [ ] **A4-M15** · El e2e del moat solo asserta exclusión de descartados; la mitad de "cocinados" nunca se compara. · Verificación · **XS** · (deseable)

### Backlog / trazabilidad
- [ ] **A4-H17** · 123/133 defectos sin enlace a historia; 0 con severidad/evidencia estructurada. FRESCO-282/313 cerrados forward-only pero figuran Finalizada. · Trazabilidad/Backlog · **M** (backfill acotado a abiertos+recientes) · —
- [ ] **A4-H18** · `project-dev-guide.md` describe Gemini Flash como dependencia viva de producción en todo el documento. FRESCO-302 se lo saltó. · Fundación · **S** · —

---

## Ola 2 — Backlog (MEDIO, sin urgencia de cohorte)

- [ ] **A4-M1** · `scoreRecipe`: jitter `Math.random()*2` ≥ el paso de la señal de rating; `get_filtered_recipes` sin `ORDER BY`; ADR-0005 "determinista" sobrevende; los tests fijan `Math.random` a 0. · Arquitectura · **S**
- [ ] **A4-M2** · `update_recipe_learning`: la media móvil de rating usa el total de cocinados como denominador → cada cocinado sin puntuar hunde `rating_promedio`. Sin test SQL. · Arquitectura · **S**
- [ ] **A4-M3** · Slot agotado por la regla de no-repetición emite advertencia con texto de seguridad alimentaria para un problema de variedad de catálogo. · Arquitectura · **S**
- [ ] **A4-M4** · `num_personas`/`adultos`/`ninos` sin límite server-side; `{num_personas: 1e6}` persiste → lista de la compra inutilizable. · Arquitectura/Seguridad · **S**
- [ ] **A4-M5** · `consolidateIngredientes`: `raciones_receta` sin guardia contra 0 → `NaN` en `coste_estimado` de toda la lista. · Arquitectura · **XS**
- [ ] **A4-M6** · `swap_meal_plan_slots` hace `ALTER TABLE … DISABLE/ENABLE TRIGGER` → lock `ACCESS EXCLUSIVE` de toda `meal_plan_recipes` en cada swap; RPC sin rate limit. · Arquitectura/Rendimiento · **M**
- [ ] **A4-M7** · `getCatalogRecipes` envía el catálogo filtrado entero (~1 MB, ~1000 filas jsonb) al cliente; facetas O(secciones×opciones×1000) por render. · Arquitectura/Rendimiento · **M**
- [ ] **A4-M8** · `normalizeNombre` (3 copias) y `getIsoWeek` (2 copias) duplicados entre runtimes sin nada que fuerce la sincronía. · Arquitectura · **S**
- [ ] **A4-M9** · Errores inesperados de Edge Function van solo a `console.error` / log drains, no a Sentry, pese a que Sentry es el backstop declarado. · Arquitectura/Observabilidad · **S**
- [ ] **A4-M10** · CSP en `Report-Only` con `'unsafe-inline'` en `script-src` — no protege contra XSS. FRESCO-312 dejó el follow-up sin ticket. · Arquitectura/Seguridad · **S**
- [ ] **A4-M11** · Un único proyecto Supabase para prod + staging + dev; `post-deploy-smoke` escribe en prod en cada deploy. · Infra · **DIFERIDO** · Remediación = aislar prod en Supabase **Pro** (NO un 2º proyecto Free — se pausa a los 7 días de inactividad, FRESCO-328). El CI ya no toca prod desde FRESCO-310 (stack local efímero). Acción real aquí: solo ADR-0020 (documentar la decisión + triggers de reapertura) y "no correr suites mutantes contra prod".
- [ ] **A4-M12** · El commit de squash que llega a producción es un SHA que la suite e2e nunca ejecutó; `strict:false` permite mergear ramas obsoletas. · Verificación/Trazabilidad · **S**
- [ ] **A4-M13** · `seed.sql` es un dump de prod regenerado a mano; nada comprueba que coincida con el catálogo de prod. · Verificación · **S**
- [ ] **A4-M14** · `retries:1` en CI + `trace:'on-first-retry'` pero el job e2e de PR no sube artefactos → el trace del retry se destruye. · Verificación · **XS**
- [ ] **A4-M16** · ~15 tickets en "Control de calidad" + 3 épicas en "Listo" con código shipeado, nunca transicionados. · Backlog · **S**
- [ ] **A4-M17** · Puntos de historia en 6/62 historias, 0/24 épicas; sin campo de sprint; velocidad no computable. · Backlog · **S** (decisión, no build)
- [ ] **A4-M18** · AC no testeable en historias abiertas; FRESCO-320 las califica "FALLA" en su propio cierre y queda Finalizada. · Backlog · **S**
- [ ] **A4-M19** · `bitacora.md` escrita para trabajo trivial (49 entradas en 4 días) contra la Regla 15; a punto de romper la rotación otra vez. · Disciplina · **XS**
- [ ] **A4-M20** · Agujero de conejo de e2e-CI: ~72s perseguidos con 3 tickets, 1 ADR, 3 PRs, 5 entradas de bitácora en un proyecto "no urgente (un committer)". · Disciplina/Verificación · **XS** (decisión: congelar)
- [ ] **A4-M21** · ADRs que faltan: cabeceras de seguridad + CSP (FRESCO-312), proyecto Supabase único (FRESCO-328). · Fundación · **S**
- [ ] **A4-M22** · ADR-0005: título y Decisión conservan Gemini para la explicación Pro (también determinista desde el 1 ago); cita ids de modelo inexistentes. · Fundación · **XS**
- [ ] **A4-M23** · MEMORY contradice `project.yaml` sobre el alias `fresco-pre` (auto-sigue HEAD vs realias manual). Riesgo de que staging sirva prod en silencio. · Disciplina · **XS** (verificar en vivo)

---

## Ola 3 — Cuando pases cerca (BAJO)

- [ ] **A4-L1** · Open redirect en `/auth/confirm`: el guard de `next` no maneja backslash inicial. · Seguridad · **XS**
- [ ] **A4-L2** · `_shared/cors.ts` incluye `http://localhost:3000` en `ALLOWED_ORIGINS` en producción. · Seguridad · **XS**
- [ ] **A4-L3** · `/api/profile/export` no neutraliza `= + - @` iniciales → CSV/formula injection. · Seguridad · **XS**
- [ ] **A4-L4** · `reassign-guest-data` verifica propiedad con `signInWithPassword` de valores del llamante → oráculo de fuerza bruta de contraseñas. · Seguridad · **S**
- [ ] **A4-L5** · `/qa` pública e indexable expone project ref + URL de Studio + contrato de API. · Seguridad · **XS**
- [ ] **A4-L6** · `searchCatalogRecipes` interpola input crudo en un filtro `.or()` de PostgREST. · Arquitectura · **XS**
- [ ] **A4-L7** · `update-recipe-status` sin whitelist de `estado`; aplica `nueva_recipe_id` sin importar estado; `rating` sin check de entero. · Arquitectura · **XS**
- [ ] **A4-L8** · Pro se gatea por `profile.plan`, nunca por `plan_expires_at` → webhook perdido = Pro gratis hasta el cron diario (≤24h). · Arquitectura · **XS**
- [ ] **A4-L9** · `swap_meal_plan_slots` no rechaza slots `excluida` ni obliga consistencia con `planning_selection`. · Arquitectura · **XS**
- [ ] **A4-L10** · Ramas que descartan cantidad en silencio: `consolidator` `canSumUnits` else; budget bucket desconocido → la advertencia de sobre-presupuesto desaparece. · Arquitectura · **XS**
- [ ] **A4-L11** · `delete-account` sin re-auth/confirmación server-side ni rate limit. · Arquitectura · **S**
- [ ] **A4-L12** · `iso-week.ts` mezcla getters locales con aritmética UTC → semana equivocada en TZ negativas. España no afectada. · Arquitectura · **XS**
- [ ] **A4-L13** · `edge-functions.ts` sigue con el comentario "these calls are stubs … swap the mock fallback" — 8 funciones desplegadas, sin mock. · Fundación · **XS**
- [ ] **A4-L14** · 75/142 escenarios `@automatizado`; 12 `@pendiente` nunca verificados ni a mano. · Verificación · **M**
- [ ] **A4-L15** · Etiquetas `@verificado-manual-<fecha>` de hace 5 semanas leídas como garantía vigente. · Verificación · **XS**
- [ ] **A4-L16** · `post-deploy-smoke.yml` corre código desde el commit desplegado con `secrets.ENV_FILE` en scope; acciones ancladas por tag móvil. · Verificación/Seguridad · **XS**
- [ ] **A4-L17** · La aserción `<10s` de `generacion-determinista` es frágil a retry — enmascara regresiones de latencia intermitentes. · Verificación · **XS**
- [ ] **A4-L18** · "Ver demo" → ancla a 4 tarjetas de texto, no hay demo. Hero mock con fecha off-by-one. · Producto · **XS**
- [ ] **A4-L19** · `epic-tree.md` desfasado pese a FRESCO-304; `_orphans/` con historias ya parented; 28 ramas locales sin podar; `dev` 2 commits por delante de main/staging. · Backlog · **XS**
- [ ] **A4-L20** · El script de sync materializa enlaces defecto↔defecto como carpetas anidadas recursivas. · Backlog · **XS**
- [ ] **A4-L21** · La CSP en prod loguea violación de `unsafe-eval` de un chunk de Next en cada carga. · Producto/Seguridad · **XS**

---

## Regresiones del propio bucle de remediación (§08 del informe)

| Ticket | Estado Jira | Qué sigue abierto |
|---|---|---|
| FRESCO-282 | Finalizada | 123/133 defectos sin enlace |
| FRESCO-313 | Finalizada | 0/133 defectos con severidad/evidencia poblada |
| FRESCO-320 | Finalizada | FRESCO-245/246/274/275 con AC no testeable ("FALLA" en su propio comentario) |
| FRESCO-328 | Finalizada | Debería ser `Rechazos` — la DB de prod sigue compartida |
| FRESCO-312 | Finalizada | CSP nunca pasó a enforcing; loguea violaciones en cada carga |

---

## Conteo

| Severidad | Nº | Ya hecho |
|---|---|---|
| BLOCKER | 4 | 0 |
| ALTO | 19 | 1 (A4-H19) |
| MEDIO | 27 | 0 |
| BAJO | 21 | 0 |
| **Total** | **71** | **1** |

Bloquean una cohorte de pago (✋): ~18. El resto es backlog normal.
