# Bitácora — Fresco

Log append-only. Cada iteración relevante suma entrada abajo: qué hecho, por qué, qué sigue. IA lee esto primero para contexto rápido en sesión nueva — no re-derivar todo desde cero. Nunca reescribir entrada vieja, solo agregar.

Formato entrada: fecha — título corto. Qué / Por qué / Siguiente.

**Cuándo escribir** (Regla 15, `CLAUDE.md`): SOLO al cerrar una historia de Jira, resolver un bug crítico, o hacer un deploy. NUNCA por trabajo trivial, cambios de texto o sesiones exploratorias.

**Rotación**: al superar 50 entradas, archivar (`mv` a `bitacora-<rango>.md`) y arrancar este archivo de nuevo con el header + las últimas ~15 entradas.

Historia archivada:
- `.context/bitacora-2026-07-to-2026-08.md` — 383 entradas, 2026-07-25 → 2026-08-27.
- `.context/bitacora-2026-08-to-09.md` — 85 entradas, 2026-08-27 → 2026-09-02.
- `.context/bitacora-2026-09.md` — 66 entradas, 2026-09-01 → 2026-09-10.

---

## 2026-09-05 - Rediseño visual v1: contrato DESIGN.md v2 + Fraunces (épica FRESCO-436)
- Qué: FRESCO-437 + FRESCO-438 + FRESCO-450, PRs #282/#283/#284 a dev -> staging -> main (7682f97).
- Por qué: rediseño visual (2 de 13 tarjetas); 450 desbloqueó test:e2e roto desde 04-sep.
- Siguiente: FRESCO-439/440/441.

## 2026-09-05 - FRESCO-439: componentes de chunky a editorial (épica FRESCO-436)
- Qué: aplicado el contrato de componentes de DESIGN.md v2 al código: `--color-surface-raised` (#fbf6ec, mas claro que el fondo) + hairline border obligatorio en `card.tsx` (mata el beige-sobre-beige); borderRadius v2 (card 32->20, lg 28->16, +image 16, pills se mantienen); tags a hairline sin relleno + nueva variante `allergen`; recipe-card/personal-recipe-card/calendar-grid a surface-raised; override cream del plan tag en el sidebar (verde oscuro). PR #285 -> dev -> staging -> main (7eaecfa).
- Por qué: 3a de 13 tarjetas del rediseno visual. El contrato ya estaba en prod desde #282, esto es el codigo poniendose al dia.
- Siguiente: FRESCO-440 (barrido de color: reasignar variant=action por "un acento por pantalla" - el Guardar del perfil sigue naranja), 441 (rediseno recipe-card + placeholder de foto), 443 (estados de formulario: inputs, focus ring, toggle invisible, defects 257/258/262/283/299).

## 2026-09-06 - FRESCO-440: disciplina de color (barrido por pantallas)
- Qué: regla "un acento = CTA" aplicada en Perfil, Biblioteca, Onboarding, Lista, error boundaries. PR #286 -> dev (6b0a999). Jira -> Control de calidad.
- Por qué: tarjeta 4 épica FRESCO-436.
- Siguiente: QA en staging.

## 2026-09-06 - FRESCO-441: recipe-card foto-protagonista + placeholder con intención
- Qué: nuevo `RecipeCardMedia` compartido (foto full-bleed o `RecipePlaceholder` = gradiente `neutral-*` por categoría + inicial en Fraunces); consumido por RecipeCard, PersonalRecipeCard y el SlotCell del calendario (drag handle vía prop `overlay`). Título h4->h5. `lib/recipes/category-gradient.ts` nuevo. §5-M en master-design-plan. PR #287 -> dev -> staging -> main (771ee79). FRESCO-440 propagó junto en el mismo ff. Jira -> Control de calidad.
- Por qué: tarjeta 5 de 13, épica FRESCO-436 (rediseño editorial).
- Siguiente: QA en staging (440 + 441); tarjeta 442 (cobertura de fotos >=90%), 443 (estados de formulario).

## 2026-09-06 - FRESCO-443 estados de formulario e inputs + primitivo Switch
- Qué: Rediseño de estados de formulario (épica FRESCO-436). Nuevo primitivo `components/ui/switch.tsx` (+6 tests), focus ring del sistema consistente en input/dropdown/switch/checkbox de signup, hover de dropdown fuera de la rampa de acento, y todos los bordes de control de formulario subidos al listón AA de 3:1 (input/dropdown `border-neutral-600`, switch OFF `bg-neutral-600`, medido en vivo). Checkbox de Terminos de /signup pasado al primitivo `Checkbox`. Los 5 defects que absorbe (257/258/262/283/299) ya estaban Finalizada; verificados en vivo. PR #288 squash a dev (581fc0d), propagado a staging y main.
- Por que: cerrar la deuda visual/a11y de formularios de la epica de rediseno; los inputs palidos y el toggle invisible eran el techo de la tarjeta.
- Siguiente: QA en staging. Epica FRESCO-436: siguen 444 (ritmo espacial), 445-449.

## 2026-09-06 - FRESCO-444: Ritmo espacial y densidad (rediseño FRESCO-436)
- Qué: Tokens `space-12/16/24` en tailwind. Columna labels calendario auto→max-content (86px). Pantallas centradas top-ancladas. Stat tiles a hairline (StatTile nuevo). Ritmo de sección space-y-16/12. PR #289 → dev/staging/main (fbc1940).
- Por qué: Tarjeta 6 épica rediseño FRESCO-436.
- Siguiente: QA en staging. Restan 445/446/447/448/449.

## 2026-09-06 - FRESCO-445: Firma editorial (footer wordmark + landing hero)
- Qué: Footer de la landing cierra con wordmark "Fresco" sobredimensionado (72/60px, Fraunces) como grafismo; se quita el logo pequeño. Hero pasa del mockup CSS con emojis a composición de 4 fotos de receta reales (curadas, hardcoded — la landing es el funnel, cero deps runtime). Fix colateral: copyright del footer era invisible (accent-500 == primary). PR #290 → dev (9a1c046), ff a staging+main.
- Por qué: Tarjeta 7 de la épica de rediseño editorial FRESCO-436 — la única que toca landing. Dos gestos de firma sin coste.
- Siguiente: QA en staging. Épica FRESCO-436 restante: 446 (motion), 447 (photo grade), 448 (craft), 449 (content design).

## 2026-09-06 - FRESCO-446: capa de motion (reveals de landing + entrada de insight-card)
- Qué: Wrapper `components/ui/reveal.tsx` (IntersectionObserver + fallback de scroll para saltos de anchor) envuelve las 7 secciones de la landing bajo el hero; reglas `[data-reveal]` / `[data-insight-enter]` en `globals.css` gated `prefers-reduced-motion: no-preference`, reusando tokens de transitions-dev (cero tokens nuevos, cero spring). `data-insight-enter` en el `learning_explanation_card` del menu. + fix de higiene: `first-menu-signal` y `onboarding-store` tests restauran `globalThis.window` en afterAll. PR #291 squash a dev (9f16072), ff a staging + main.
- Por qué: Tarjeta 8 de la epica FRESCO-436 (rediseno editorial). La app se sentia estatica; DESIGN.md v2 §Motion ya especificaba estas dos adiciones.
- Siguiente: QA en staging. Epica FRESCO-436: quedan tarjetas 447 (photo grade) y las de coordinacion.

## 2026-09-06 - FRESCO-447: tratamiento visual de foto (ratio unico + grade)
- Que: Nueva utilidad `.recipe-photo` en `globals.css` (grade calido leve, filtro unico) aplicada a la foto real en `RecipeCardMedia` (Menu/Calendario/Biblioteca/Favoritos) + detalle de receta + thumb admin. Detalle de receta (catalogo y propia) migrado de `aspect-video` 16/9 + icono pelado a `aspect-[4/3]` + `RecipePlaceholder` + grade. DESIGN.md nueva §Photography; master-design-plan §4.11/§5-S/§8. PR #292 squash a dev (1db0396), ff a staging + main.
- Por que: Tarjeta 9 de la epica FRESCO-436. Compensar el no gastar en fotografia: 600 fotos de 600 fuentes deben parecer la misma marca. Distinto de FRESCO-435 (foto correcta).
- Siguiente: QA en staging. Epica FRESCO-436: quedan 448 (craft) y 449 (content design).
## 2026-09-07 - FRESCO-449 content design: nombres de receta + microcopy
- Qué: catálogo de 1000 recetas limpiado de filler del generador combinatorio (780 nombres cambiados, script determinístico sin LLM); sección Voice en DESIGN.md; 2 fixes de microcopy (hype/genérico). Review adversarial encontró 4 issues reales (script mismatch con la guía + gap CI de env vars a nivel de módulo), todos corregidos. PR #294 mergeado a main, prod deployed.
- Por qué: nombres de receta con filler repetitivo ("al estilo mediterráneo", "versión ligera"...) dañaban la calidad percibida. Decisión del usuario: sin gasto en LLM.
- Siguiente: FRESCO-453 (tech-debt, catálogo con 782/1000 recetas casi-duplicadas descubierto durante la limpieza) queda para dimensionar y podar/repoblar el catálogo.
## 2026-09-07 - FRESCO-454 actualización de boilerplate a 7ede94e (v8.4)
- Qué: sync completo (272 archivos: migración .claude/skills -> .agents/skills, CLAUDE.md -> AGENTS.md, skills nuevos project-context/jira-administration/autonomous-delivery) + 19 hallazgos de paridad resueltos a mano (3 bloqueantes: hooks de Claude, MCP mirror en opencode/codex). Se destrackearon 459 archivos de .context/PBI/ (drift histórico, tag pbi-pre-cache-migration). Se mantuvo tsconfig.json, el ignore-list de eslint y scripts.test del proyecto (upstream los hubiera roto). Coverage ratchet ajustado (cli/ excluido) y CI arreglado (symlink de skills regenerado antes de repo:check).
- Por qué: la nueva versión del updater trabaja por paridad en vez de pisar archivos; había que adoptarla antes de que el drift creciera más.
- Siguiente: rebuild de .context/PBI/ desde Jira + auditar contenido que solo vivía en git (pasos 4-5 de la receta de migración), pendiente. Línea ATLASSIAN_URL obsoleta en .env, sin tocar.
## 2026-09-07 - FRESCO-428 consentimiento de cookies + gate PostHog
- Qué: banner de cookies (Aceptar/Rechazar/Configurar), gate de posthog.init() tras consentimiento (ADR-0025), tabla de política de cookies, enlaces "Configurar cookies" en footer y Ajustes. PR #296 mergeada a dev, propagada a staging y main (fef3ee7). También FRESCO-459: velocidad del marquee del hero a la mitad.
- Por qué: cierra infracción activa de LSSI art. 22.2 / guía AEPD (PostHog se inicializaba sin consentimiento) — bloqueante del camino "poder cobrar".
- Siguiente: QA verifica en staging (fuera de alcance de este flujo). Sin trabajo pendiente en FRESCO-428.

## 2026-09-08 - FRESCO-463: batch de 15 escenarios e2e (@edge-case) del ratchet FRESCO-321
- Qué: 15 escenarios manuales de regression.feature automatizados en PR #311 (0ee0b97). Ratio 89->104 @automatizado. Nuevo generacion-menu-edge.steps.ts. 15/15 verde local.
- Por qué: escenarios core sin spec, invisibles a CI. Tope de 15 por wall-clock de test:e2e (ADR-0018).
- Siguiente: QA en staging. FRESCO-467 en Listo; 464/465/466 en backlog.
## 2026-09-08 - FRESCO-467: templates de email Auth alineados al rediseno + email_change brandeado
- Que: confirmation/recovery a Fraunces + card 20px/#FBF6EC/hairline + voz calmada (sin voseo/emoji/hype) + tagline real. Nuevo email_change.html (era stub ingles con enlace) branded, espanol, con codigo {{ .Token }}. PR #312 squash a staging (3871070), ff a dev. Aplicado al hosted jdqemhewjrjuopssdurn (los 3 entornos) por Management API PATCH, verificado por GET. supabase/templates/** anadido a .impeccable ignoreFiles (email HTML, medio distinto).
- Por que: los templates se quedaron pre-FRESCO-436; el email_change en ingles sin marca era un defecto en el camino de conversion invitado->cuenta.
- Siguiente: QA prueba de envio real en staging (Gmail web/app + Outlook/dark). Mirror a main pendiente de confirmacion.

## 2026-09-10 - FRESCO-488 capa ingrediente-producto + reversion de scope integracion supermercados
- Que: Spike FRESCO-345 (deep-link Carrefour/Dia + export contra lista real, scripts/spikes/fresco-345-grocery-deeplink/). Creada FRESCO-488 (capa ingrediente->producto + reconciliacion de unidades, 5 SP, bloquea 345/346). FRESCO-345 refinada a v2 (export-first, deep-link descartado). Decision de fundador: sacar FRESCO-332/345/346 del Out-of-Scope Blacklist (ADR-0027). business-model.md y mvp-scope.md actualizados. staging @ 1fdce25+.
- Por que: el fundador quiere la integracion con supermercados como valor anadido. Restriccion "sin coste extra": el carrito real via proveedor (Northfork/Whisk) sigue fuera; lo abordable a coste cero es export + deep-link de afiliacion (Awin). Recomendacion registrada en contra de adelantarlo antes de validar retencion; decision del fundador prevalece.
- Siguiente: FRESCO-488 primero (bloquea al resto). Refinar FRESCO-345 pieza A (export) y FRESCO-346 para build. Alta en Awin cuando se aborde el deep-link. Rotar bitacora.md (65 entradas, supera el tope de 50).

## 2026-09-10 - FRESCO-488 capa ingrediente-producto: implementada y desplegada
- Que: lib/grocery/ (mapShoppingListItem puro + diccionario canonico de 199 ingredientes generado desde el vocabulario del Edge + overlay de envases curado a mano + parity/drift tests). PR #316 squash a staging (5ad8c43), ff-mirror a dev y main. Los 3 branches en 5ad8c43. CI verde (5/5 incl test:e2e en PR y en push a staging). Jira -> Finalizada.
- Por que: prerrequisito transversal de FRESCO-345/346, desbloqueado por el carve-out ADR-0027. Sin consumidores todavia (por diseno) — deja resuelta la parte mas incierta de cualquier integracion de super.
- Siguiente: fresco-pro redesplegando (impacto runtime cero: lib sin consumidores + docs). FRESCO-345 pieza A (export) y FRESCO-346 quedan listas para build cuando toque. Archivar sesion sprint-development/FRESCO-488.

## 2026-09-10 - FRESCO-489: primera tanda de fotos verificada por agente
- Que: 50 candidatos de FRESCO-31 revisados por agente-vision. 10 aplicadas / 40 rechazadas (4 con marca). recipes.foto_url 468 -> 478, 0 duplicados. FRESCO-489 -> Finalizada.
- Por que: valida el camino a coste cero de la Opcion A de FRESCO-435 (verificacion por agente, sin API key). Elimina la QA manual por tanda de FRESCO-192.
- Siguiente: repetir por tanda mientras FRESCO-31 siga abierta (333 activas sin foto). Unsplash rate-limit 50/h obliga a esperar entre tandas.
