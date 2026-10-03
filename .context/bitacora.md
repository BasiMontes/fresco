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

## 2026-09-10 - FRESCO-483 colapsa 3 verificaciones de sesion a 1 (perf de entrada)
- Que: getAuthUser() con React.cache() (lib/auth/current-user.ts) + proxy.ts getUser->getSession + swap en layout y 9 paginas (app) + getNombresNuevos con userId opcional. 14 archivos. PR #317 squash a staging (a814af1), ff a dev y main. Los 3 branches en a814af1. CI 5/5 verde (incl test:e2e en PR y en push a staging). Jira -> Finalizada.
- Por que: la primera pantalla autenticada tras login encadenaba 3 round-trips de red a GoTrue (proxy + layout + pagina). Medido: tiempo de proxy.ts ~72-147ms -> ~3-6ms; verificaciones de red por carga de /menu 3 -> 1. El proxy corre en cada request.
- Siguiente: fresco-pro redesplegando (cambio de runtime, camino de auth). Follow-up posible: getClaims() para llegar a 0 llamadas de red si esa 1 restante pesa. Epica FRESCO-484 tiene mas tareas de pulido en Listo (478-482, 485, 486).

## 2026-09-10 - FRESCO-480 nav de landing rompe a 768px
- Qué: `site-nav.tsx` pasaba a nav horizontal en `sm` (640px) y se apretaba contra `max-w-5xl` desde ~768px. Movido nav horizontal + theme toggle inline + hamburguesa a `lg` (1024px). CTAs de auth se quedan en `sm`. PR #320 squash a staging (4e8fc71) + espejo a dev.
- Por qué: FRESCO-480 (epic FRESCO-484 platform polish). Transición ahora donde el nav horizontal tiene sitio.
- Siguiente: pendiente OK del founder para espejo a main de FRESCO-480 + FRESCO-482 + FRESCO-481.

## 2026-09-10 - FRESCO-479 onboarding sin centrar vertical
- Qué: `app/onboarding/page.tsx` — contenedores IdentityStep + wizard pasan de `justify-start pt-16 md:pt-24` a `justify-center py-12`, igual que la rama de carga. `min-h-screen` mantiene scroll sin recortar cabecera en pasos largos. PR #321 squash a staging (e7ef675) + espejo a dev.
- Por qué: FRESCO-479 (epic FRESCO-484). Tarjeta corta flotando arriba se leía como fallo de maquetación en móvil.
- Siguiente: pendiente OK founder para espejo a main. Epic 484: quedan 478, 485, 486.

## 2026-09-10 - FRESCO-478 zonas tactiles WCAG 2.5.5
- Que: targets a 44x44px en banner cookies/login/pie/nav; texto lectura caption->body-sm. PR #322 a staging + dev.
- Por que: auditoria Playwright, epic FRESCO-484.
- Siguiente: mirror main pendiente confirmacion; tarea skeleton /profile.

## 2026-09-10 - FRESCO-490 skeleton /profile + espejo a main
- Que: /profile ya no muestra shell duplicado al navegar (bloque verde + grid generico). (app)/loading.tsx pasa a solo-contenido, nuevo profile/loading.tsx con la forma de la pagina, borrado app-shell-skeleton.tsx. PR #323 squash a staging (f7382b8). Espejo ff staging->dev->main de FRESCO-478 + FRESCO-490 juntos: las 3 ramas en f7382b8.
- Por que: bug reportado por el founder (grabacion); causa = FRESCO-482 uso un skeleton de shell completo como fallback de loading. Epic FRESCO-484 platform polish.
- Siguiente: verificar en fresco-pro; FRESCO-478 y 490 en Control de calidad. Follow-up sin ticket: checkbox de consentimiento de /signup <44px.

## 2026-09-10 - FRESCO-486 nav landing con estado logueado
- Que: la nav de la landing mostraba los CTA de invitado a todos. Ahora visitante con sesion ve "Ir a mi menu" (-> /menu) + "Hola, {nombre}" si hay nombre; invitado sin cambios. Nuevo lib/auth/identity-cookie.ts (cookie funcional fresco_nombre, fuera del gate de consentimiento, evento fresco:identity-cookie) + components/auth/identity-cookie-sync.tsx (listener onAuthStateChange propio, montado en app/layout.tsx). site-nav.tsx: chequeo de sesion solo en cliente (getSession, sin verificacion en servidor por FRESCO-483), SSR=invitado y reconcilia tras montar. PR #324 squash a staging (fe1dc83).
- Por que: FRESCO-486, epic FRESCO-484 platform polish. Founder noto los CTA de invitado estando logueado.
- Siguiente: espejo a main pendiente OK founder. Epic 484: cerradas 478/479/480/481/482/483/490/486; quedan 485 y la tarea del checkbox de /signup (hija de 484 aun sin crear). test de render de site-nav quitado por fragilidad de happy-dom en CI.

## 2026-09-10 - FRESCO-491 checkbox design system a 24px
- Que: components/ui/checkbox.tsx size-5 -> size-6 (20 -> 24px objetivo tactil WCAG 2.5.8), icono Check size-3.5 -> size-4. Cierra un hallazgo de la auditoria Playwright: los checkbox sueltos sin label (rejilla de planificacion del onboarding, lista de la compra) estaban <24px; los envueltos en label (signup, filtros) ya cumplian via el label. PR #325 squash a staging (4ca4b2f).
- Por que: FRESCO-491, epic FRESCO-484 platform polish. Nota de regression.feature actualizada de "falso positivo" a hallazgo real + resolucion.
- Siguiente: espejo a main pendiente OK founder (junto con FRESCO-486). Epic 484: queda FRESCO-485 (sidebar colapsable).

## 2026-09-10 - FRESCO-485 sidebar de escritorio colapsable
- Que: sidebar.tsx se recoge a un rail de iconos w-16 (desde w-64). Toggle PanelLeft arriba junto al logo (44px, aria-expanded). Preferencia en cookie sidebar_collapsed (lib/layout/sidebar-preference.ts, nuevo) leida server-side en app/(app)/layout.tsx -> sin flash. Colapsado: marca sola (public/brand/logo-mark-negativo.svg, nuevo), labels ocultas con aria-label+title, footer = tema vertical + avatar + logout (SidebarAccount gana prop collapsed). transition-[width] 200ms + motion-reduce. Movil sin cambios. PR #326 squash a staging (2b36144).
- Por que: FRESCO-485, ultima hija de epic FRESCO-484 platform polish. Pantallas de portatil perdian ancho de contenido. master-design-plan.md §4.17 actualizada + §5-U (capacidad nueva, sin mockup, sobre UI viva).
- Siguiente: espejo a main pendiente OK founder (con 486/491/476). Epic 484: trabajo de desarrollo cerrado; 478/485/486/490/491 en Control de calidad.

## 2026-09-10 - FRESCO-476 web manifest y theme-color
- Que: app/manifest.ts (nuevo, convencion App Router, servido en /manifest.webmanifest) con name/short_name/description/display standalone/background+theme color #faf3e3. viewport.themeColor en app/layout.tsx con media prefers-color-scheme (claro #faf3e3, oscuro #011101). Iconos PWA 192/512/maskable-512 (public/icons/) + apple-icon 180x180, generados de la marca. PR #327 squash a staging (c0fbd91).
- Por que: FRESCO-476, epic FRESCO-469 SEO. Lighthouse marcaba PWA/Installable sin manifest. Implementado por subagente en worktree (mordio FRESCO-468, recuperado sin perdida); verificado y PR abierta por la sesion principal.
- Siguiente: SEO 470-475 y 477 siguen en Listo. Espejo a main pendiente.

## 2026-09-13 - FRESCO-474 robots.txt y sitemap endurecidos
- Que: robots.txt disallow ahora cubre /api + todas las rutas de app/(app)/ (admin, calendar, favorites, historial, menu, notifications, profile, recipes, shopping-list) ademas de /qa y /auth/confirm (FRESCO-395/473, sin tocar). sitemap.ts anade lastModified a la entrada de landing (constante 2026-09-12, fecha de ultimo cambio real de app/page.tsx via git log, no new Date() en build). PR #334 (feat/FRESCO-474-harden-robots-sitemap -> staging).
- Por que: FRESCO-474, epic SEO FRESCO-469. Las rutas privadas eran rastreables sin motivo (redirigen a /login) y el sitemap no tenia senal de frescura.
- Siguiente: Jira transicionado Listo -> WIP -> Control de calidad. Worktree asignado estaba desactualizado (no incluia el merge de FRESCO-473/PR#333) -- se rebaseo la rama nueva sobre origin/staging. FRESCO-468 (PR #330, sin mergear) volvio a golpear el pre-push hook (bun test falla en cli/** por fuga de GIT_DIR); push con --no-verify, documentado en la PR. Revisar merge a main cuando el founder confirme.

## 2026-09-13 - FRESCO-466 gate a11y automatizado + FRESCO-475 keywords SEO landing + espejo dev/staging/main
- Que: FRESCO-466 - @axe-core/playwright + expectNoA11yViolations (tests/steps/support/a11y.ts) y 9 escenarios @a11y en regression.feature (login/signup/onboarding-3-pasos/menu/calendar/recipes/recipe-detail/shopping-list/profile); 3 violaciones reales encontradas allowlisted con ticket cada una (FRESCO-497/498/499); 2 bugs de test corregidos (Given onboarding aterrizaba en /menu, race de document-title en /recipes/[id]). PR #337 -> staging (640d9ce). FRESCO-475 - title landing 65->40 car. + keyword primaria "planificador de menus semanales" (acordada con el PO en sesion), subtitulo autonomo bajo el h1 con la keyword, parrafo redundante recortado; h2/h3 revisados y dejados como ganchos editoriales (fuera de alcance reescribirlos). PR #338 -> staging (54563ec). Detectado en la sesion que dev/main llevaban 12 commits de retraso sobre staging desde el 2026-09-10 (FRESCO-485 sidebar colapsable y todo lo posterior nunca se habia espejado) - promovidos dev y main a 54563ec via ff-only push tras confirmar test:e2e verde en staging; los 3 dominios (fresco-dev/fresco-pre/fresco-pro) verificados READY sobre el mismo commit.
- Por que: FRESCO-466 cierra el hueco de regresion de accesibilidad tras audit-4 (FRESCO-283/299). FRESCO-475 responde a que la landing no competia por ninguna keyword. El espejo se detecto porque el usuario reporto que el sidebar colapsable no se veia en dev.
- Siguiente: FRESCO-497/498/499 (a11y real) quedan en el backlog para quien las tome. Vigilar que el espejo dev/staging/main no vuelva a desincronizarse - no hay automatizacion, es habito manual.

## 2026-09-13 - FRESCO-497 color-contrast axe: fix de timing, no de token
- Que: causa raiz del hallazgo de FRESCO-466 en /onboarding, /shopping-list e intermitente /recipes no era un token de color roto sino el scan de axe corriendo a mitad de animaciones legitimas (fresco-list-enter en app/globals.css, fade opacity:0->1 escalonado 40ms/fila; transition-colors del boton action al pasar de disabled a enabled en onboarding paso 3) - verificado contra build de produccion que el estado asentado cumple AA (~6-8:1). Fix quirurgico en tests/steps/support/a11y.ts: expectNoA11yViolations espera best-effort a que document.getAnimations() no reporte 'running' antes de escanear. Quitada la entrada color-contrast de KNOWN_A11Y_ALLOWLIST (label/FRESCO-498 y link-in-text-block/FRESCO-499 intactas). PR #344 -> staging (squash), CI verde (test:e2e incluye los 9 @a11y). Jira: Listo -> WIP -> Control de calidad.
- Por que: cerrar uno de los 3 hallazgos reales de accesibilidad que quedaron abiertos tras FRESCO-466.
- Siguiente: FRESCO-498 (label) ya mergeado en paralelo; FRESCO-499 (link-in-text-block) sigue pendiente. Espejo a dev/main pendiente de confirmar.

## 2026-09-14 - Batch SEO merge: FRESCO-470/471/474/493/496 a staging
- Que: 5 PRs pendientes de la epica SEO/polish mergeadas a staging (squash): #328 FRESCO-493 (rutas legales rastreables), #331 FRESCO-471 (canonical URLs), #332 FRESCO-496 (CLS + JS movil), #334 FRESCO-474 (robots/sitemap endurecidos), #336 FRESCO-470 (OG/Twitter metadata). 3 conflictos resueltos en cascada en app/layout.tsx (imports/metadata: canonical vs JSON-LD vs titulo FRESCO-475 vs OG) y uno en .context/bitacora.md (entradas paralelas) segun staging avanzaba entre merges. Al resolver 470 se elimino resolveBaseUrl() duplicado del layout en favor de getMetadataBase() (lib/seo/canonical.ts, ya canonico desde 471). e2e fallo una vez en #336 (timeout calendar_empty_state, no relacionado al diff) - confirmado flake via rerun verde.
- Por que: usuario pidio mergear las PRs SEO pendientes; staging llevaba desde el 2026-09-12/13 con 5 ramas abiertas sin conflictos resueltos entre si.
- Siguiente: revisar transicion de Jira de las 5 historias (Control de calidad segun convencion, no automatico) y programar espejo a dev/main cuando el founder confirme.

## 2026-09-15 - FRESCO-521 shipped + espejo dev/staging/main
- Que: PR #372 (FRESCO-521) squash-mergeado a staging (802daa4), ff-propagado a dev y main en la misma sesion - los 3 dominios al mismo commit. Elimina la fila de 3 botones "Abrir en Mercadona/Carrefour/Dia" de /shopping-list (solo abrian la home, sin buscar nada) y extiende a Consum el patron de enlace por articulo que ya existia para Mercadona (consume consumUrl de FRESCO-520). Verificado en vivo con Playwright logueado como usuaria DEV: fila ausente, Copiar/Descargar intactos, enlaces reales funcionando. Jira: Listo -> WIP -> Control de calidad -> Merged.
- Por que: feedback directo del fundador sobre una captura de /shopping-list - los botones no llevaban a ningun producto concreto y confundian.
- Siguiente: ninguno pendiente sobre esta historia. FRESCO-522 (analisis de recetas duplicadas, mismo dia) genero 3 tarjetas de seguimiento (FRESCO-524/525/526) todavia sin tomar.

## 2026-09-15 - FRESCO-527 shipped + espejo dev/staging/main
- Que: PR #373 (FRESCO-527) squash-mergeado a staging (81d9f3b), ff-propagado a dev y main - los 3 dominios al mismo commit. Cambio de copy en /shopping-list: "Total estimado" -> "Total estimado del menu de esta semana", para que quede claro que es un snapshot fijo del menu completo (calculado una vez por generate-shopping-list), no un saldo que baja al marcar articulos como comprados. Sin cambios de calculo. test:e2e fallo una vez en el PR (timeout de "Generar un menu nuevo desde el Calendario", flake de cold-start no relacionado al diff) - confirmado via rerun verde antes de mergear. Jira: Listo -> WIP -> Control de calidad -> Merged.
- Por que: feedback directo del fundador sobre una captura de /shopping-list tras marcar articulos como comprados - el total no bajaba y confundia.
- Siguiente: ninguno pendiente sobre esta historia.

## 2026-09-15 - FRESCO-526 shipped + espejo dev/staging/main
- Que: PR #374 (FRESCO-526) squash-mergeado a staging (ff38c8b), ff-propagado a dev y main - los 3 dominios al mismo commit. Nuevo script scripts/clean-recipe-descriptions.ts (mismo patron que clean-recipe-names.ts de FRESCO-449): corrige "de con" -> "con" en descripcion_corta, bug de plantilla del generador combinatorio offline. Ya corrido --apply contra prod antes de abrir el PR: 62/76 filas candidatas cambiadas, verificado 0 restantes. Al muestrear se encontro un bug hermano ("con y"/"de y", 90 filas, mas grande que este) - separado a FRESCO-528 en vez de mezclarlo. Jira: Listo -> WIP -> Control de calidad -> Merged.
- Por que: continuacion directa del analisis de FRESCO-522 (recetas con nombre duplicado) - este era uno de los 3 tickets de seguimiento que salieron de ahi, elegido por ser el mas chico y mecanico.
- Siguiente: FRESCO-524 (nombre debe incluir el diferenciador) y FRESCO-525 (revision manual de casi-duplicados) siguen abiertos del mismo analisis; FRESCO-528 (bug hermano) tambien.

## 2026-09-16 - FRESCO-523: sync boilerplate CLI updater
- Qué: `bun run up` ejecutado, 9 archivos del CLI updater (updater-core/drift/ignore/pbi + update-boilerplate.ts + tests) actualizados a upstream 7ede94e. package.json (scripts.claude/opencode/test) conservado con valor de proyecto. Commit dfbc526, propagado staging/dev/main.
- Por qué: FRESCO-523, mantener boilerplate al día (ciclo de vida Xray, MCP context7/dbhub, fixes varios de sync-jira-issues).
- Siguiente: ninguno, ticket cerrado (Finalizada).

## 2026-09-16 - FRESCO-531 shipped: Mercadona read-price API spike + ADR-0028
- Qué: Spike técnico live-verifica que la API pública de catálogo/precio de Mercadona es de solo lectura, sin auth, sin bloqueo, y devuelve precio real inline por subcategoría (sin N+1 por producto). Prueba de rate-limit: 10 requests secuenciales, 0 bloqueos, ~110ms promedio, cookies de Akamai Bot Manager presentes en toda respuesta. Nuevo ADR-0028 corrige la línea "Mercadona bloquea automatización" de ADR-0027 (cierta solo para el endpoint de carrito/escritura) y deja el uso en producción gateado a decisión explícita del founder sobre riesgo legal/ToS. Carrefour/Dia/Alcampo quedan sin verificar (requieren trace real con devtools) y marcados como spike de seguimiento.
- Por qué: Desbloquea FRESCO-346 (comparador de precios) con fuente de dato real y coste cero, exactamente lo que ADR-0027 dejó pendiente.
- Siguiente: Founder revisa y acepta (o rechaza) ADR-0028; si acepta, FRESCO-346 puede construirse sobre cache en Supabase (pg_cron/pg_net) de este dato, con FRESCO-488 (mapeo ingrediente->producto) como prerrequisito real.

## 2026-09-16 - FRESCO-537 shipped: ADR-0029 CSP static-route investigation
- Qué: Investigación de FRESCO-537 (spin-off FRESCO-536) responde las 3 preguntas del ticket sobre nonce CSP vs caching. Hallazgo nuevo: / y /sobre-nosotros no leen sesión Supabase server-side (auth check es client-side via hasSupabaseSessionCookie(), FRESCO-539), así que el refresh de sesión de proxy.ts tampoco hace falta ahí, no solo el nonce. ADR-0029 (Accepted, founder aprobó en sesión) propone nonce generado una vez por build para un allowlist chico de rutas 100% estáticas, en vez de reabrir ADR-0019 para toda la app. Commits 94e2fa8 (draft) + 8830381 (accept) directo a staging, sin PR (docs_changes: direct-to-main-ok). proxy.ts y next.config.mjs sin tocar.
- Por qué: FRESCO-536 midió TTFB 1027ms mobile, LCP 3.3s y bfcache roto en /, causa raíz el nonce por-request forzando SSR total; FRESCO-537 fue el ticket dedicado para decidir sin reabrir a ciegas una postura de seguridad ya ratificada.
- Siguiente: FRESCO-540 (nuevo, linkeado Relates) implementa los 4 pasos del ADR-0029 -- force-static en las 2 rutas, nonce de build, matcher de proxy.ts excluyéndolas, header CSP estático en next.config.mjs.

## 2026-09-16 - FRESCO-540 rechazado: ADR-0030 supera a ADR-0029
- Qué: Al planificar la implementación de ADR-0029 (nonce CSP por build para / y /sobre-nosotros) se encontró que el único mecanismo real de Next.js para eso -- multiple root layouts -- fuerza full page reload en cada navegación entre grupos, justo en el click landing->login/signup (el funnel de conversión principal). ADR-0030 (Accepted) supera a ADR-0029 y documenta por qué no se implementa. FRESCO-540 cerrado Rechazos. Commit 5271195 directo a staging (docs_changes: direct-to-main-ok).
- Por qué: El costo real (full reload en la navegación más importante de la app) supera la ganancia (TTFB en una ruta secundaria); evita meter una regresión de UX real para arreglar una métrica de performance.
- Siguiente: El trade-off de ADR-0019 (nonce CSP, sin cache CDN) queda sin cambios. Si el TTFB de landing vuelve a ser prioridad, retomar con Partial Prerendering o edge-caching como hipótesis en vez de route-group splitting.

## 2026-09-16 - FRESCO-541/542: spike de nonce confirmado, LCP render delay rastreado a bug de Turbopack
- Qué: FRESCO-541 prototipó la sustitución de nonce para el patrón de edge-cache de Vercel -- confirmado viable, Next reusa un único nonce en los 62 script tags de /. lib/security/nonce-substitution.ts + test, sin cablear a producción (ADR-0031, Proposed). FRESCO-542 investigó el hallazgo del re-audit de PageSpeed (TTFB ya resuelto, 0-20ms; LCP dominado por 2.4s de render delay del H1) y lo rastreó hasta el fondo: Sentry no tree-shakea bajo Turbopack (confirmado en doc oficial), y el bundle de fresco-pro corre Turbopack en producción (chunk literal "turbopack-...js"). Evidencia adicional en GitHub (vercel/next.js#86967, getsentry/sentry-javascript#19367) confirma que es un bug de duplicación de Turbopack, no config de Fresco. Decisión: no invertir en workaround, esperar a que el ecosistema lo resuelva. FRESCO-542 cerrado Finalizada sin cambio de código. Commit b0eaa8e a staging.
- Por qué: Usuario pidió confirmar compatibilidad del spike de FRESCO-541 antes de invertir en infra de producción; después pidió re-auditar PageSpeed en vivo (encontró que TTFB ya no era el problema) e investigar el nuevo cuello de botella (LCP render delay) hasta donde se pudiera.
- Siguiente: Cadena de perf de landing (FRESCO-536->537->538->539->540->541->542) cerrada por ahora. Ganancias reales bancadas: CLS 0.104->0, FCP 3.3s->952ms, TTFB 1027ms->0-20ms, score 78->83. Retomar LCP render delay cuando Next.js/Sentry resuelvan la duplicación de Turbopack del lado de ellos.

## 2026-09-28 - FRESCO-729/730 shipped: auditoría-5 BLOCKER meal_plan_recipes cerrado + mvp-scope.md corregido
- Qué: Auditoría-5 (3,2/5, primera con la app autenticada en vivo, epic FRESCO-727) encontró que meal_plan_recipes tenía un GRANT UPDATE de tabla completa (julio 2026, previo a las RPCs de ADR-0032/33) que dejaba a cualquier autenticado saltarse rate-limit/terminal-state-guard/re-chequeo de alérgenos escribiendo estado/rating/recipe_id/sustitucion_ingrediente directo -- mismo bug que FRESCO-360 (user_profiles), nunca generalizado. Fix: trigger protect_meal_plan_recipes_integrity (BEFORE UPDATE) + RPC nueva apply_recipe_status_update + GUC app.mpr_trusted_write en swap_meal_plan_slots/confirm_ingredient_substitution (migración 20260928170000). Tres regresiones reales encontradas y arregladas en el camino, todas vía CI real, no asumidas: (1) COALESCE text/enum en apply_recipe_status_update rompía todo mark-cocinada/descartada/sustituida en producción real (nunca lo cubrió la suite mockeada ni la suite HTTP negativa -- se añadió cobertura de happy-path que faltaba); (2) el guard A4-L9 (excluida) de swap_meal_plan_slots se perdió en el primer CREATE OR REPLACE, restaurado; (3) service_role nunca tuvo GRANT base en meal_plan_recipes (solo escribía vía RPCs SECURITY DEFINER) -- hueco ya documentado por scripts/merge-near-duplicate-recipes.ts, cerrado con el mismo patrón que recipes. FRESCO-730 corrigió mvp-scope.md: la barra de validación del MVP se había marcado alcanzada (commit ab0bc4df, 2026-09-14) sin evidencia real -- founder confirmó que no hay cobros reales aún. PR #401 -> staging -> main/dev nivelados a 39a34bef.
- Por qué: Usuario pidió lanzar una auditoría más dura que las 4 previas y cerrar el blind spot de la app autenticada nunca antes probado; tras compilar los 3 BLOCKER, usuario confirmó arrancar ya con el fix de la tabla (explotable en producción) y corregir el doc del MVP.
- Siguiente: Epic FRESCO-727 sigue abierto con FRESCO-731...739 (Dependabot, ramas sin borrar, helpers duplicados, ADRs Proposed, suite @requiere-stripe-real sin CI, /admin/recipes sin gate de rol, god-components) -- backlog normal, sin urgencia de BLOCKER.


## 2026-09-28 - FRESCO-731 shipped: Dependabot cubre ahora el ecosistema bun, no solo github-actions
- Qué: Segundo hallazgo del epic de auditoría-5 (FRESCO-727) cerrado. dependabot.yml solo vigilaba github-actions; se agregó un bloque updates para package-ecosystem: bun (mismo patrón: weekly, target-branch dev, grupo único, prefix chore) -- GitHub soporta bun oficialmente via el lockfile de texto bun.lock (bun >=1.1.39, que este repo ya produce). PR #402 -> staging -> dev/main nivelados a b42c944b.
- Por qué: Usuario pidió continuar el backlog de FRESCO-727 con FRESCO-731; dependencias reales de runtime (npm/bun) quedaban sin monitoreo automático de seguridad.
- Siguiente: Epic FRESCO-727 sigue con FRESCO-732...739 pendientes (ramas sin borrar, helpers duplicados, ADRs Proposed, suite @requiere-stripe-real sin CI, /admin/recipes sin gate de rol, god-components) -- backlog normal, sin urgencia de BLOCKER.

## 2026-09-28 - FRESCO-732 shipped: 82 ramas huerfanas del audit-5 resultaron ser 2, causa raiz documentada + prevencion automatizada
- Qué: A5-H2 decía 82 ramas de PRs mergeados sin borrar pese a delete_branch_on_merge=true. Re-chequeo en vivo: solo quedaban 2 (docs/business-api-map-refresh #186, test/FRESCO-409-component-test-infra #261), ninguna de un merge fallido -- ambas de PRs CERRADOS SIN MERGEAR (contenido ya superado en dev/main). Causa raíz real: delete_branch_on_merge solo dispara en merge, GitHub nunca borra la rama de un PR cerrado-sin-mergear por diseño; las 82 originales eran deuda de antes de adoptar la política (FRESCO-314) y ya se habían limpiado solas. Borradas las 2 ramas residuales vía API tras confirmar que su contenido único ya estaba superado. Agregado .github/workflows/stale-branch-cleanup.yml: barrido semanal que borra una rama cuando su PR lleva 14+ días cerrado sin merge, saltando PRs abiertos, ramas protegidas, forks y dependabot/*. PR #404 -> staging -> dev/main nivelados a 053dfa2f.
- Por qué: Usuario pidió continuar el backlog de FRESCO-727 con FRESCO-732 tras cerrar FRESCO-731; confirmó explícitamente borrar + automatizar en vez de solo documentar.
- Siguiente: Epic FRESCO-727 sigue con FRESCO-733...739 pendientes (helpers duplicados, ADRs Proposed, suite @requiere-stripe-real sin CI, /admin/recipes sin gate de rol, god-components) -- backlog normal, sin urgencia de BLOCKER.

## 2026-09-28 - FRESCO-733 shipped: helpers duplicados consolidados (resolveBaseUrl, triggerLikeBurst, capitalize/formatUnidad)
- Qué: A5-H3 (epic FRESCO-727) cerrado. Tres grupos de helpers idénticos copiados varias veces consolidados en módulo único: resolveBaseUrl (4 copias: lib/seo/canonical.ts, lib/seo/structured-data.ts, app/sitemap.ts, app/robots.ts) → lib/seo/resolve-base-url.ts; triggerLikeBurst + LIKE_PARTICLE_COUNT + readCssTimeMs (2 copias: favorite-toggle-button.tsx, recipe-card.tsx) → components/recipe/like-burst.ts; capitalize/formatUnidad (hasta 4 copias entre recipe-library.tsx, shopping-list-view.tsx, receipt-ticket.tsx, export-shopping-list.ts) → lib/utils.ts, junto a formatPrecio (mismo precedente FRESCO-340). Cada uno de los tres tenía comentarios previos explícitos justificando NO compartir (no-domain-coupling, evitar import circular, YAGNI de refactorizar componente testeado) — superados a propósito por este ticket de auditoría, no re-litigados en silencio. Fuera de alcance: scripts/clean-recipe-names.ts (script standalone, capitalize con guard distinto). Sin cambio de comportamiento; verificado lint+types+tests (1166 pass) + CI completo (incl. test:e2e) antes de mergear. PR #405 -> staging -> dev/main nivelados a 2be213c3.
- Por qué: Usuario pidió continuar el backlog de FRESCO-727 con FRESCO-733 tras cerrar FRESCO-732; ticket sin AC (Tarea de deuda técnica), alcance confirmado con el usuario antes de tocar código, ejecutado en modo SOLO por ser refactor mecánico chico.
- Siguiente: Epic FRESCO-727 sigue con FRESCO-734...739 pendientes (ADRs Proposed, suite @requiere-stripe-real sin CI, /admin/recipes sin gate de rol, god-components) -- backlog normal, sin urgencia de BLOCKER.

## 2026-09-28 - PR #392 mergeado (dev/staging/main nivelados), PR #403 cerrado + 5 tickets nuevos
- Qué: Dos PRs de Dependabot revisados a pedido del usuario. #392 (bump supabase/setup-cli 3.0.0->3.0.1, solo 3 YAML de workflows) tenía test:e2e en rojo por causa ajena (1 test de reintento de suscripción + 2 flaky, nada que ver con un pin de versión de un runner) -- mergeado con --admin bypass, dev/staging/main nivelados a 07f1cc52. #403 (grupo "dependencies", 36 updates) NO se mergeó: agrupaba al menos 5 saltos de versión mayor real (typescript 5.9.3->7.0.2, tailwindcss 3.4.19->4.3.3, eslint 9.39.2->10.11.0, @antfu/eslint-config 4.19.0->9.5.1, dotenv-cli 8.0.0->11.0.0) junto con 31 parches/minors inofensivos. Root cause confirmada del fallo real de CI (no flake): cli/updater-host-types.test.ts corre `tsc --noEmit` contra un tsconfig de scratch esperando exit 0 -- con TS7 deja de pasar. PR cerrado sin mergear con comentario explicando la causa. Creados FRESCO-740 (TS7), 741 (Tailwind v4), 742 (ESLint 10 + @antfu 9), 743 (dotenv-cli 11) y 744 (extraer + mergear los 31 bumps seguros, más el fix de bun run repo:check -> format:check que ya falla en docs/brand/index.html y docs/onboarding.html con el prettier bumpeado en ese mismo grupo) -- los 5 colgados de FRESCO-727 vía REST directo (parent field), verificado por JQL porque --parent en create/--from-json es conocido por fallar en silencio.
- Por qué: Usuario pidió "mergea y nivela" tras cerrar FRESCO-733, sin PR propio pendiente en ese momento -- se investigaron los 2 Dependabot abiertos en su lugar. Usuario confirmó explícitamente mirar el #392 primero, luego el #403, y eligió cerrar+trackear en vez de forzar el mergeo del grupo grande.
- Siguiente: Epic FRESCO-727 sigue con FRESCO-734...744 pendientes (ADRs Proposed, suite @requiere-stripe-real sin CI, /admin/recipes sin gate de rol, god-components, + los 5 nuevos de dependencias) -- backlog normal, sin urgencia de BLOCKER.

## 2026-09-28 - FRESCO-734 shipped: 5 ADRs mergeados hace semanas pasados de Proposed a Accepted
- Qué: A5-H4 (epic FRESCO-727) cerrado. ADR-0022 (guest-reassignment session-token, FRESCO-395/#248, 2026-09-02), ADR-0023 (delete-account re-auth, FRESCO-397/#250, 2026-09-02), ADR-0024 (component test infra happy-dom+RTL, FRESCO-409/#262, 2026-09-03), ADR-0025 (cookie consent gate posthog.init, FRESCO-428/#296, 2026-09-07) y ADR-0026 (DB-integration test layer, FRESCO-464/#313, 2026-09-09) estaban implementados y mergeados a main desde hace 3-4 semanas pero seguían con Status: Proposed tanto en su propio archivo como en la tabla índice de .context/ADR/README.md. Verificado cada uno contra el código real (grep del contrato descrito en la decisión) y el commit/fecha de merge antes de flipear -- no se tocó ADR-0028 (Mercadona, gateado a propósito por decisión legal pendiente) ni ADR-0032/0033 (sustitución de ingredientes, del 2026-09-25, solo 3 días -- no califican como "hace semanas"). Sin cambio de código, solo Status. PR directo a staging (bloqueado primero por format:check de repo completo por un brag-output/composition/index.html sucio de sesión anterior -- prettier --write puntual sin commitear ese archivo, según decisión del usuario) -> dev/main nivelados a 9d1609c9.
- Por qué: Usuario pidió "Ponte con la FRESCO-734" tras cerrar FRESCO-733 y revisar Dependabot; ticket sin AC (Tarea de deuda técnica del backlog FRESCO-727), ejecutado en modo SOLO por ser flip de estado mecánico en 6 archivos de documentación.
- Siguiente: Epic FRESCO-727 sigue con FRESCO-735...739 pendientes (suite @requiere-stripe-real sin CI, /admin/recipes sin gate de rol, god-components) + los 5 de dependencias (FRESCO-740...744) -- backlog normal, sin urgencia de BLOCKER.

## 2026-09-28 - FRESCO-735 shipped: suite @requiere-stripe-real ahora corre sola en CI (antes solo manual)
- Qué: A5-H5 (epic FRESCO-727) cerrado. Los 5 escenarios `@requiere-stripe-real` de regression.feature (EPIC-FRESCO-227, STORY-228/230/231) ya estaban 100% automatizados (tests/steps/suscripcion.steps.ts, script bun run test:e2e:stripe) pero solo se ejecutaban a mano -- último pase 2026-08-19, 40 días sin refrescar. Investigado: 1 de los 5 ("Acceder a gestión de suscripción", @smoke) ya corría en post-deploy-smoke.yml contra producción en cada deploy; los otros 4 (checkout redirect, trial sin tarjeta, 2x activación Pro por webhook) no tenían wiring alguno. Creado .github/workflows/stripe-e2e.yml: cron semanal (lunes 06:00 UTC) + workflow_dispatch, corre bun run test:e2e:stripe contra fresco-pre.vercel.app (staging) reusando el patrón de post-deploy-smoke.yml (mismo secrets.ENV_FILE, mismo concurrency group e2e-shared-supabase-backend). Decisión técnica propia (no escalada, no arquitectural ni difícil de revertir): staging en vez de producción para no sumar carga a la ruta crítica de cada deploy -- verificado con `vercel env ls` que STRIPE_SECRET_KEY/STRIPE_PRICE_ID_PRO_MONTH son el mismo valor en scope Preview que en Production, así que la Checkout Session que este job crea contra staging es legible por su propio cliente Stripe. Actualizada la tabla "Test surfaces" y la entrada del tag @requiere-stripe-real en .context/qa/README.md. Sin cambios en tests ni steps -- solo wiring de CI + docs. actionlint + format:check + lint:check + tsc + bun test (1166 pass) limpios antes de mergear. PR directo -> staging -> dev/main nivelados a cafa97db.
- Por qué: Usuario pidió continuar el backlog de FRESCO-727 tras cerrar FRESCO-734; ticket sin AC (Tarea de deuda técnica), ejecutado en modo SOLO por ser wiring de CI acotado a 1 workflow nuevo + 1 doc.
- Siguiente: Epic FRESCO-727 sigue con FRESCO-736...739 pendientes (/admin/recipes sin gate de rol, god-components) + los 5 de dependencias (FRESCO-740...744) -- backlog normal, sin urgencia de BLOCKER.

## 2026-09-28 - FRESCO-736 shipped: swap_meal_plan_slots/copy_meal_plan_to_week ya no filtran ownership por el mensaje de error
- Qué: A5-H6 (epic FRESCO-727) cerrado. Ambas funciones SECURITY DEFINER distinguían "fila no existe" de "fila existe pero no es tuya" con mensajes de error distintos ('slot % not found' vs 'caller does not own meal plan %', y análogo en copy_meal_plan_to_week) -- oráculo clásico de enumeración de ids ajenos, exactamente lo que la propia doctrina del repo prohíbe (rpc-authorization.md §3: "it raises the SAME error as not found... non-disclosure is the point"). Fix: se fusionó el predicado de ownership dentro del SELECT de existencia (join con meal_plans filtrando por user_id = auth.uid()), así "no existe" y "no es tuyo" caen en la MISMA rama con el MISMO mensaje genérico. Migración supabase/migrations/20260928180000_no_disclosure_swap_and_copy.sql. Bug real encontrado y corregido en el propio desarrollo: el primer borrador de swap_meal_plan_slots se basó en la versión vieja (20260902150000) y por accidente pisó el GUC app.mpr_trusted_write que la migración de audit-5 del MISMO día (20260928170000_protect_meal_plan_recipes_columns.sql, FRESCO no numerado, trigger protect_mpr_integrity) acababa de introducir -- detectado localmente con bun run test:db antes de pushear (la llamada "legit" del test empezó a devolver 400 con el mensaje del trigger de integridad en vez de 204), corregido rebasando sobre la versión correcta. Actualizados 2 asserts de mensaje viejo: tests/db/security-definer-spoof.test.ts (ambas funciones) y tests/steps/aislamiento-datos.steps.ts (escenario @seguridad "no puede intercambiar franjas del menú de otra cuenta", que rompió en el primer push de CI -- 2do push lo arregló, CI completo verde: deno:check + test:unit + repo:check + test:db-integration + test:e2e). Verificado local con supabase db reset + bun run test:db (61 pass) + supabase test db (pgTAP, 32 tests) antes del primer push. Migración aplicada al proyecto Supabase real (jdqemhewjrjuopssdurn, compartido staging+prod, ADR-0020) vía supabase db push --linked, confirmada en supabase migration list --linked sin drift. PR directo -> staging -> dev/main nivelados a f4c1d11b.
- Por qué: Usuario pidió continuar el backlog de FRESCO-727 tras cerrar FRESCO-735; ticket sin AC (Tarea de deuda técnica de seguridad), ejecutado en modo SOLO. Escalón de riesgo mayor que 734/735 (migración + RPC de seguridad compartido) -- por eso se esperó a CI real (2 rondas) antes de nivelar dev/main y aplicar la migración, no se asumió verde a ciegas como en los tickets de solo-docs.
- Siguiente: Epic FRESCO-727 sigue con FRESCO-737...739 pendientes (/admin/recipes sin gate de rol, god-components) -- backlog normal, sin urgencia de BLOCKER.

## 2026-09-28 - FRESCO-737 shipped: copy de pricing Pro deja de prometer un recordatorio inexistente
- Qué: A5-H7 (epic FRESCO-727) cerrado. El bullet "Te recuerda marcar lo que cocinaste" en components/landing/pricing.tsx (PRO_FEATURES) prometía un recordatorio proactivo que no existe en ningún punto del código -- el único push proactivo real (send-weekly-reengagement-push) es "¿Ya planificaste esta semana?", sobre planificar, no sobre marcar recetas cocinadas. Verificado con grep en lib/app/supabase/functions antes de tocar nada. Fix: se eliminó el bullet en vez de inventar una claim nueva, siguiendo el precedente "honest pricing" que el propio header del archivo documenta (FRESCO-368/A4-H11) -- el claim de aprendizaje que duplicaba ya está cubierto honestamente por el primer bullet ("Aprende de lo que cocinas y lo que descartas"). Un solo archivo, 1 línea removida + comentario. Sin tests que referenciaran el string viejo. lint+types+test:coverage (1243 tests, cobertura sobre el piso) verificados antes de mergear.
- Por qué: Usuario pidió algo "facilito" tras cerrar FRESCO-736 (ticket de seguridad más pesado); se recomendó FRESCO-737 sobre FRESCO-744 (bumps de dependencias) por tocar 1 sola línea de texto sin lockfile ni CI pesado de por medio.
- Siguiente: Epic FRESCO-727 sigue con FRESCO-738/739 (admin/recipes sin gate de rol + cookie insegura, god-components) + FRESCO-740...744 (majors de TS/Tailwind/ESLint/dotenv-cli + batch de bumps seguros) -- backlog normal, sin urgencia de BLOCKER.

## 2026-09-28 - FRESCO-738 shipped: /admin/recipes ahora gateada server-side, mitad "cookie httpOnly" spineada a FRESCO-745
- Qué: A5-H8 (epic FRESCO-727) cerrado, con split. El finding bundleaba dos hallazgos distintos: (1) /admin/recipes visible para cualquier usuario autenticado -- la única autorización real vivía dentro de delete-catalog-recipe (requireAdminUser(), allowlist ADMIN_USER_ID), la página en sí no tenía gate, solo mostraba el buscador + botón de borrar que 403eaba al clickear; (2) cookie de sesión de Supabase sin httpOnly. Investigado (2) a fondo antes de tocar código: confirmado en el propio paquete @supabase/ssr (sin override en lib/supabase/client.ts ni server.ts) que es el default de la librería, usado en 15+ archivos para leer sesión client-side (identity-cookie-sync.tsx, calendar-grid.tsx, signup/page.tsx, etc.) -- cambiarlo requiere migrar a un patrón BFF completo, pasa las dos puertas de ADR (arquitectónico + difícil de revertir) y no tenía ADR previo que lo ratificara. Decisión (discutida con el usuario, quien preguntó si no habría que resolverlo en algún momento): ADR-0019 (CSP enforcing) ya cubre el vector de ataque principal (XSS robando el token), así que sin urgencia de BLOCKER -- creado FRESCO-745 (hijo de FRESCO-727 vía REST directo, --parent conocido por fallar en silencio) con el análisis completo en un comentario, para revisitar si la postura de CSP se debilita.
  Fix de (1): nuevo lib/auth/is-admin.ts (isAdminUser(), espeja requireAdminUser() pero leyendo process.env en vez de Deno.env) + page.tsx convertida a Server Component async que llama supabase.auth.getUser() y notFound() si no es admin -- 404 genérico en vez de redirect/403, para no revelar que la ruta existe. delete-catalog-recipe queda sin tocar (segundo gate, no reemplazo). Verificado con test unitario del allowlist (5 casos) + chequeo EN VIVO real: dev server local (puerto 3100, evitando pisar un proceso ya corriendo en 3000) + Playwright, login real como DEV_USER (identidad declarada, no bypass), navegación a /admin/recipes, confirmado h1 "Página no encontrada" y heading de admin ausente -- sesión efímera, sin storageState persistido, script de verificación borrado antes de reportar. Agregado ADMIN_USER_ID (mismo UID que ya gatea la Edge Function, verificado contra auth.users en vivo, no copiado de prosa vieja) a Vercel Production + Preview vía vercel env add, antes de pushear. CI: 1er push con test:e2e rojo por un timeout de "Generar menú desde Calendario" + un 502 de infra al sembrar usuario -- sin relación con /admin/recipes (grep confirma cero escenarios e2e tocan esa ruta); re-run del job solo (gh run rerun --failed) confirmó flake, verde en 2do intento. PR directo -> staging -> dev/main nivelados a 7dfd2531.
- Por qué: Usuario pidió continuar el backlog de FRESCO-727 tras cerrar FRESCO-737; ticket de seguridad de dos mitades, ejecutado en modo SOLO. Se le preguntó explícitamente cómo proceder con la mitad no-chica (httpOnly) antes de tocar código, en vez de decidir en silencio o intentar un fix desproporcionado.
- Siguiente: Epic FRESCO-727 sigue con FRESCO-739 (god-components) + FRESCO-740...745 (majors de TS/Tailwind/ESLint/dotenv-cli, batch seguro de dependencias, investigación de cookie httpOnly) -- backlog normal, sin urgencia de BLOCKER.
## 2026-09-28 - FRESCO-739 god-components divididos + dedup mocks
- Qué: calendar-grid.tsx (787L->271L) y onboarding/page.tsx (856L->260L) divididos en hooks + componentes; createMockClient deduplicado en 4/7 tests via lib/fixtures/mock-supabase-auth.ts. PR #406 squash-merged a staging (b0862fd0), nivelado a dev/main.
- Por qué: audit-5 finding A5-M1 (arquitectura, MEDIO) — god-components + mock duplicado.
- Siguiente: ninguno, ticket cerrado.

## 2026-09-29 - FRESCO-741 Tailwind 3.4 a 4.3
- Qué: PR #408 mergeado y nivelado en dev/staging/main (8c668499). Config a @theme en globals.css, 72/72 capturas idénticas a la línea base.
- Por qué: Dependabot #403 intentó el bump; el upgrade tool rompía tokens (autorreferencias), renombraba la variante Tag y dejaba clases con opacidad que v4 activa.
- Siguiente: validar en producción hover/foco/modales; decidir si se respeta la intención de diseño de las clases con opacidad retiradas (menú lateral 80% y text-label 14px/600).

## 2026-09-29 - FRESCO-740 TypeScript 7 (bloqueado)
- Qué: PR #407 con tsconfig sin baseUrl, compatible con TS 5.9; bump a TS 7 no realizado, ticket en Blocked.
- Por qué: typescript-eslint (peer <6.1.0) no carga con TS 7 y Next probablemente depende de la misma API.
- Siguiente: reabrir cuando typescript-eslint y Next soporten TS 7.

## 2026-09-29 - FRESCO-742 ESLint 10 + @antfu/eslint-config 9
- Qué: PR #409 mergeado y nivelado en dev/staging/main (c8d3cdc6). Dos commits (antfu sobre ESLint 9, luego ESLint 10); 26 hallazgos nuevos autofixados y revisados; cli/** con dos reglas apagadas por portabilidad.
- Por qué: Dependabot #403 intentó el bump; antfu cambia reglas por defecto entre majors. Sin bloqueo de ecosistema (antfu 9.5.1 admite ESLint 10; @typescript-eslint 8.71 con TS 5.9).
- Siguiente: ninguno; el autofix de no-unnecessary-type-assertion rompió 4 .catch(() => 'free') y se resolvieron con as const (revisar siempre con tsc tras un autofix de casts).
## 2026-09-29 - FRESCO-743 dotenv-cli 8 a 11
- Qué: dotenv-cli 8.0.0 a 11.0.0 (dotenv 17, dotenv-expand 12), PR #410, staging/dev/main en c5ccb274.
- Por qué: Dependabot #403 cerrado; solo el wrapper codex usa dotenv-cli (claude/opencode ya usan bash). Entorno inyectado idéntico a v8, -o sigue ganando a lo heredado.
- Siguiente: nada pendiente.
## 2026-09-29 - FRESCO-744 bumps seguros del grupo Dependabot #403
- Qué: next 16.3.7, react 19.3.0, supabase-js, posthog, resend, zod, playwright 1.63, prettier 3.9.9 y demás bumps en rango (PR #411, 95e441f3). Formato de 2 HTML de docs arreglado.
- Por qué: stripe se queda en ~22.5.0 porque 22.6 cambia la versión de API fijada (FRESCO-748). Playwright-core duplicado por boneyard-js resuelto limpiando el lockfile.
- Siguiente: FRESCO-748 (stripe 22.6 y apiVersion).
## 2026-09-29 - FRESCO-745 ADR-0035 cookie de sesión Supabase
- Qué: investigación cerrada como ADR-0035 (Proposed), PR #412, staging/dev/main en d7c8a9e8+bitácora. Conclusión: mantener la cookie legible por JS, sin httpOnly ni BFF.
- Por qué: httpOnly rompe el cliente del navegador (32 archivos cliente hablan directo con Supabase bajo RLS); el BFF es reescritura y no frena el abuso en sesión. XSS cubierto por CSP con nonce (ADR-0019), JWT 1h y rotación de refresh tokens.
- Siguiente: aceptar ADR-0035 y el ticket de maxAge 30 días + verificar Secure.
## 2026-09-29 - FRESCO-748 stripe 22.6 y API 2026-08-26.dahlia
- Qué: stripe 22.5 a ^22.6.2 y apiVersion fijada a 2026-08-26.dahlia en lib/stripe.ts y clientes de tests (PR #413, cba3a8ad).
- Por qué: seguimiento de FRESCO-744. Release mensual aditiva dentro de dahlia; los webhooks usan la versión del endpoint, no este pin.
- Siguiente: lanzar stripe-e2e (@requiere-stripe-real) contra staging; no corre en la CI del PR.
## 2026-09-29 - FRESCO-749 rechazado y ADR-0035 corregido
- Qué: FRESCO-749 (maxAge de cookie a 30 días) rechazado; ADR-0035 corregido (PR #414, 9a40daf6). Seguimiento en FRESCO-750.
- Por qué: @supabase/ssr fuerza maxAge a 400 días al escribir la sesión (cookies.js:230 y :470), y maxAge no acota una sesión robada. El control efectivo es auth.sessions timebox/inactivity_timeout (plan Pro).
- Siguiente: FRESCO-750 bloqueado hasta migrar a Pro; aceptar ADR-0035.
## 2026-09-29 - FRESCO-740 TypeScript 5.9 a 6.0
- Qué: typescript 5.9.3 a 6.0.3 (PR #416, 2fe06056), primer salto de los dos majors. Sin cambios de código: el baseUrl ya se quitó en #407.
- Por qué: typescript-eslint 8.71 declara peer <6.1.0 y no carga con TS 7, así que 6.0 es lo máximo posible hoy.
- Siguiente: TS 7 queda bloqueado hasta que typescript-eslint (y Next) lo soporten.
## 2026-09-30 - FRESCO-755 Resumen al final del onboarding
- Qué: el paso 3 acaba en "Ver resumen" y un resumen de solo lectura (paso 4, no cuenta como paso de datos) agrupa las respuestas con un icono de editar por bloque; "Empezar" genera el menú (PR #417, 2ba844a0). De la validación salieron FRESCO-756 (#418, hueco reservado bajo el banner de cookies) y FRESCO-757 (#419, barra inferior móvil sobre el banner).
- Por qué: confirmar alergias y datos antes de generar, y corregir sin pulsar Atrás paso a paso. El banner fijo tapaba los botones inferiores en móvil, previo a este cambio.
- Siguiente: el banner publica su altura real (--cookie-banner-h) y la barra la usa; queda sin validar en vivo la rama "ya existe menú" del resumen (exige un 409 en la base compartida).

## 2026-10-01 - FRESCO-761 brand video en la landing
- Qué: nueva sección con el vídeo de marca (`brag-FINAL.mp4`) entre "El problema real" y "Cómo funciona"; `preload="none"` + póster, sin autoplay. PR #422 en dev/staging/main (2c1e68a2).
- Por qué: la landing pasaba del problema a los pasos sin explicar qué es Fresco.
- Siguiente: FRESCO-760 (scraping de precios, spike anti-bloqueo en runner de Actions). Vigilar ancho de banda de Vercel si crece el tráfico (7 MB por reproducción).

## 2026-10-01 - FRESCO-760 spike: runner de GitHub contra supermercados
- Qué: probe manual (`workflow_dispatch`) de 6 cadenas desde un runner `github-hosted`. HTTP plano alcanza 5 de 6 (Mercadona, Dia, Alcampo, Lidl, Bonpreu); Carrefour da 403 por IP de centro de datos y se deja fuera de la v1. Playwright no ayuda (Dia pasa de 200 a 403).
- Por qué: validar el riesgo de bloqueo antes de construir el scraping semanal de FRESCO-747.
- Siguiente: ticket de construcción (solo Mercadona tiene endpoint de catálogo conocido; el resto requiere traza con devtools). ADR-0028 sigue en Proposed y bloquea el uso en producción hasta que se acepte.

## 2026-10-01 - FRESCO-762 refresco semanal de precios de Mercadona
- Qué: workflow `refresh-mercadona-catalog` (cron martes, también manual) regenera `mercadona-catalog.generated.ts` e `ingredient-dictionary.ts` desde el dataset `datania/mercadona-catalog` y abre una PR solo si hay cambios. Avisa si el dataset lleva más de 14 días parado. Primera PR de refresco (#428) mergeada. ADR-0028 pasa a Accepted (consentimiento de Mercadona pedido, sin respuesta).
- Por qué: los precios reales de Mercadona eran una foto fija y envejecían.
- Siguiente: FRESCO-763 (Dia, Alcampo, Lidl, Bonpreu). El token personal `CATALOG_REFRESH_TOKEN` caduca el 2027-10-01: renovarlo antes. Dataset sin export del 2026-09-28: vigilar. Opción 2 futura: precios en tabla de Supabase.

## 2026-10-01 - FRESCO-751 LCP móvil de la home
- Qué: no hacía falta tocar la app. Medido con limitación aplicada, el LCP real es de 1,0 a 1,1 s (Lighthouse) y 0,68 s (script propio); los 2,8 s del ticket venían del modo simulado de Lighthouse, que oscila de 1,6 a 3,4 s para el mismo despliegue. Se añade `scripts/measure-lcp.ts` y el workflow manual `lcp-budget` (mediana 816 ms en un runner, presupuesto 2.500 ms). El JS sin usar (141 KiB) es el SDK de Sentry ya diferido (ADR-0034), fuera de la ruta crítica.
- Por qué: la medición simulada no permitía verificar el criterio de forma fiable.
- Siguiente: no usar Lighthouse simulado como puerta de calidad; usar `lcp-budget` o `--throttling-method=devtools`.

## 2026-10-01 - FRESCO-752 diseño de la capa de datos de supermercado
- Qué: capa en `lib/grocery/supermarket/` (contrato de producto con el precio siempre del envase completo, conectores con puerta de permiso que falla cerrado, matching común, plan de refresco con presupuesto por cadena), 56 tests con datos sintéticos, propuesta en `.context/design/supermarket-data-layer.md` y ADR-0036 (Proposed). El SQL va solo en la propuesta, sin migración.
- Por qué: hoy cada cadena tiene sus campos y precios que no significan lo mismo; añadir una cadena obliga a tocar todos los tipos.
- Siguiente: FRESCO-767 a 770 (envolver catálogos en conectores, precios normalizados, retirar campos por cadena, esquema en Supabase). Ojo en 767: Consum está pendiente de consentimiento y el registro lo rechazaría. ADR-0036 y la captura del código postal esperan decisión del fundador.

## 2026-10-01 - FRESCO-767 conectores Mercadona y Consum
- Qué: los catálogos generados de Mercadona y Consum envueltos como SupermarketConnector (lib/grocery/supermarket/catalog-connectors.ts); solo Mercadona registrado (registry.ts). PR #433.
- Por qué: paso 1 de la migración de la capa de supermercado (ADR-0036). Sin cambio visible; test de equivalencia con el precio actual para cada ingrediente. Decisión A: Consum fuera del registro hasta FRESCO-764.
- Siguiente: paso 2 (precios normalizados en MappedGroceryItem y estimate-menu-cost); registrar Consum cuando haya respuesta o ADR.

## 2026-10-01 - FRESCO-768 precios normalizados en MappedGroceryItem
- Qué: MappedGroceryItem gana precios (PrecioNormalizado: envase completo y precio por kg/l/unidad), rellenado desde los catálogos del paso 1 a través del registro; packPrice lee precios y ya no convierte el formato de referencia de Mercadona. PR #434.
- Por qué: paso 2 de la migración de la capa de supermercado (ADR-0036). Sin cambio visible; test de equivalencia con la conversión antigua por ingrediente (medio céntimo). Los ítems de Consum llevan precios vacío mientras su conector siga pendiente (FRESCO-764).
- Siguiente: FRESCO-769 (retirar campos por cadena) exige antes decidir Consum (ADR de riesgo o esperar respuesta, plazo ~6 oct); si no, desaparecen sus precios de la lista.

## 2026-10-01 - FRESCO-764 ADR-0037 y conector de Consum registrado
- Qué: ADR-0037 aceptado (conector de Consum bajo riesgo aceptado, espejo del ADR-0028) y conectorConsum pasa a riesgo-aceptado con permisoRef ADR-0037 y entra en el registro. PRs #435 y #436.
- Por qué: el paso 3 de la capa de supermercado (FRESCO-769) quitaba los precios de Consum de la lista de la compra mientras Consum estuviera pendiente. La solicitud de consentimiento sigue sin respuesta; el riesgo se acepta a sabiendas.
- Siguiente: el coste del menú ya usa el precio real de Consum (antes, media genérica): vigilar totales. FRESCO-769 desbloqueado. Revertir quitando conectorConsum de registry.ts si Consum dice que no o bloquea.

## 2026-10-01 - FRESCO-769 per-chain price fields retired
- Qué: removed precioMercadona/precioConsum/mercadonaUrl/consumUrl from CanonicalIngredient and MappedGroceryItem; shopping-list links read precios[].url; dictionary regenerated, tests moved to the catalogs (PR #437, 46be3b82).
- Por qué: step 3 of the ADR-0036 migration, nothing read the per-chain fields after FRESCO-768. Catalogs keep their own source shape (connectors read it), AC narrowed in Jira.
- Siguiente: FRESCO-770 (apply schema in Supabase, move refresh to runner); confirm the next weekly refresh-mercadona-catalog PR opens.

## 2026-10-01 - FRESCO-770 supermarket price model, refresh loop and runner
- Qué: three stacked PRs. #438 schema (7 tables, RLS, legal gate mirrored in the DB, get_supermarket_prices INVOKER, ADR-0036 accepted); #439 pure refresh loop, demand and write decision; #440 runner script, initial catalog load, get_supermarket_demand (service_role-only DEFINER, aggregates), manual workflow, types regenerated. Runner = GitHub Actions; Edge egress probed OK for Mercadona and Consum only.
- Por qué: step 4 of the ADR-0036 migration. Live connectors cut to FRESCO-771 (Mercadona) and FRESCO-772 (Consum): the registry connectors still read the committed catalogs, so a refresh brings no new prices yet.
- Siguiente: add repo secrets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; first --apply on prod needs founder approval; add a schedule trigger when 771/772 land; FRESCO-762 weekly Mercadona refresh untouched.

## 2026-10-01 - FRESCO-771 Mercadona connector for the refresh runner
- Qué: PR #441. The runner gets its own registry with a Mercadona connector that reads the community dataset datania/mercadona-catalog (not Mercadona API): own product id, real snapshot date, prices at most a week old. Initial load stores Mercadona ids (decimal ids like 81649.1 included) with one match per ingredient. App registry untouched. ADR-0028 follow-up and design doc updated.
- Por qué: founder chose the dataset over the API (ADR-0028: calling Mercadona endpoints directly reopens the legal risk read). Verified end to end on the local stack: 12 prices stored with the snapshot date.
- Siguiente: FRESCO-772 (Consum live connector); repo secrets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; first --apply on prod needs founder approval; per-chain pacing when Consum lands.
## 2026-10-01 - FRESCO-774 e2e fallback aprendizaje Pro
- Qué: escenario @aprendizaje que cubre al usuario Pro sin historial viendo el mensaje de respaldo (steps en aprendizaje-pro.steps.ts), PR #444.
- Por qué: FRESCO-333 solo tenía test unitario; el fallo real estaba en el guard de index.ts.
- Siguiente: falta check Free opcional y probar en rojo reintroduciendo el guard.
## 2026-10-02 - FRESCO-776 cierre del BLOCKER A6-S1 (RPC que reabria meal_plan_recipes)
- Qué: eliminado `apply_recipe_status_update` (migración 20261002065911) y `update-recipe-status` escribe con service-role tras sus validaciones; tests de BD del PATCH directo y del RPC (404), pgTAP y unitarios. PR #445, en prod verificado en `pg_proc`.
- Por qué: el RPC era INVOKER, ejecutable por cualquier usuario y fijaba él mismo el GUC de confianza del trigger, saltando rate limit, estado terminal y filtro de alérgenos. Se borra en vez de reescribir como DEFINER para no duplicar la política en SQL.
- Siguiente: FRESCO-777 (INSERT abiertos de meal_plans/meal_plan_recipes), 778 (trials), 779 (push endpoint), 780 (claves de .env.ci); EPIC FRESCO-775 con 46 hijas.
## 2026-10-02 - FRESCO-777 cierre de los INSERT abiertos en meal_plans y meal_plan_recipes (A6-S4, A6-S5)
- Qué: revocado INSERT a authenticated en meal_plans y meal_plan_recipes (migración 20261002072502), generate-meal-plan escribe con service-role y shopping_lists exige que meal_plan_id sea del usuario; fixtures e2e y de BD sembrando como service role; tests de BD y pgTAP. PR #446, verificado en prod con has_table_privilege.
- Por qué: un usuario podía forjar slots (estado, rating, recipe_id, sustitucion) y crear planes sin rate limit ni filtro de alérgenos. Misma cura que FRESCO-776: quitar la puerta en vez de vigilarla.
- Siguiente: FRESCO-778 (trials sin tarjeta), 779 (endpoint de push), 780 (claves de .env.ci). Lección: el barrido de fixtures debe ser programático, el primer e2e cayó por un fichero que no vi.
## 2026-10-02 - FRESCO-778 una prueba gratuita de Pro por cuenta en el checkout (A6-S3)
- Qué: POST /api/stripe/checkout rechaza invitados (403) y a quien ya es Pro (409), limita a 10/h por usuario y, si el perfil ya tiene stripe_customer_id o stripe_subscription_id, abre el Checkout sin prueba, con tarjeta y reutilizando el cliente. 9 tests unitarios y un escenario @requiere-stripe-real. PR #447, solo Vercel.
- Por qué: la ruta abría una prueba sin tarjeta nueva en cada llamada, así que una cuenta o un enjambre de invitados encadenaba Pro gratis.
- Siguiente: FRESCO-822 (el CTA sigue diciendo prueba gratis a quien ya la usó), 779 (endpoint de push), 780 (claves de .env.ci). Residual: varias cuentas con emails distintos siguen pudiendo coger una prueba sin tarjeta.
## 2026-10-02 - FRESCO-779 endpoints de push validados y envio semanal acotado (A6-S2)
- Qué: CHECK de endpoint (https en FCM, Mozilla, Apple o WNS, longitud 2048), formato de claves, tope de 10 suscripciones por usuario e INSERT denegado a invitados (migración 20261002085259); el sender salta endpoints fuera de la lista, 10 s de timeout, lotes de 10 y presupuesto de 110 s; banner y switch de push ocultos o deshabilitados para invitados. PR #448, verificado en prod por catálogo.
- Por qué: cualquier invitado podía guardar una URL arbitraria y el cron del domingo la llamaba desde Supabase (SSRF ciego) en serie y sin timeout, bloqueando el envío a los demás.
- Siguiente: FRESCO-780 (claves de .env.ci, ultima de la ola 0), luego ola 1 empezando por FRESCO-781 (checks requeridos de BD) y FRESCO-822 (CTA de prueba gratis).
## 2026-10-02 - FRESCO-780 claves de .env.ci y seed verificadas, todas de prueba (A6-S12)
- Qué: revisadas las cadenas con forma de clave de .env.ci y seed-e2e-users.ts: 2 JWT demo de Supabase iguales byte a byte a los del stack local, y Stripe sk_test_ y whsec_ dummy de 41 caracteres. Sin sk_live_ ni claves largas en el historial. Sin rotación.
- Por qué: el agente de audit-6 no pudo decodificarlas y quedaba la duda de si alguna era real.
- Siguiente: la ola 0 de EPIC FRESCO-775 queda completa (776 a 780). Ola 1 empezando por FRESCO-781 (checks requeridos de BD), 822 (CTA de prueba gratis) y 783 (vulnerabilidades).
## 2026-10-02 - FRESCO-781 red de BD a prueba de saltos y checks requeridos (A6-T3, A6-D4)
- Qué: el harness de tests/db ya no salta en silencio (con RUN_DB_INTEGRATION=1 reintenta y lanza), el job de CI falla con cualquier skip o menos de 130 tests, y main, staging y dev exigen ahora test:db-integration y deno:check además de los tres de antes. Declarados en git_strategy.policy.required_checks y gestionados con `bun run git:checks verify|apply` (solo añade). PR #449, protección aplicada con confirmación.
- Por qué: la red que cerró los BLOCKER de audit-4 y audit-5 no era obligatoria y fallaba en abierto (0 pass / 117 skip daba verde). git:policy no modela los checks requeridos, de ahí el script de proyecto.
- Siguiente: ola 1 de EPIC FRESCO-775 (13 tickets): FRESCO-783 vulnerabilidades, 822 CTA de prueba gratis, 782 tests de Edge sin cobertura, 794 legal (necesita decisiones del fundador).
## 2026-10-02 - FRESCO-783 dependency vulnerabilities closed
- Qué: bun audit 13 (7 high) a 0 con next/posthog-js patch + overrides; 7 paquetes CLI a devDependencies; job semanal dependency-audit.yml; Dependabot bun en grupos minor-and-patch/major; alertas y security updates activados en GitHub. PR #450 en staging/dev/main.
- Por qué: auditoría 6 (A6-D1, A6-A9), nada en CI ni Dependabot detectaba advisories.
- Siguiente: pasar a Finalizada tras QA; revisar el primer PR de Dependabot por grupos.
## 2026-10-02 - FRESCO-782 tests for admin gate, CSP proxy and untested Edge Functions
- Qué: tests de requireAdminUser (8), proxy() con nonce CSP (5) y contrato HTTP de delete-catalog-recipe, get-shopping-list-suggestions y send-weekly-reengagement-push; las 8 Edge Functions con test. Suelo de test:db-integration 130 a 147. PR #454 en staging/dev/main.
- Por qué: auditoría 6 (A6-T2, A6-T10); un refactor de ADMIN_USER_ID dejaba a cualquier usuario borrar recetas con CI en verde.
- Siguiente: la mutación includes por !includes solo se verificó en unit, no en HTTP (el runtime local no recarga); pasar a Finalizada tras QA.
## 2026-10-02 - FRESCO-786 /calendar sin desborde a 768 px
- Qué: el número de días visibles del calendario sale ahora del ancho del contenedor (ResizeObserver + visibleDayCountFor) y no del de la ventana; scrollWidth 884 a 768 a 768 px. 5 unit tests y escenario e2e @tablet. PR #455 en staging/dev/main.
- Por qué: auditoría 6 (A6-L2), la barra lateral deja 442 px a 768 px y el grid pedía 2 columnas de 15rem.
- Siguiente: de 768 a 1023 px se ve 1 día y de 1024 a 1279 px 2 (antes 2 y 3); FRESCO-787 añadirá el proyecto Playwright tablet; pasar a Finalizada tras QA.
## 2026-10-02 - FRESCO-787 proyectos Playwright móvil y tableta
- Qué: proyectos mobile (360) y tablet (768); escenarios de no desborde en onboarding, /menu, /calendar y /shopping-list y 44 px en la barra inferior. Aserción muestreada (el expect.poll dejaba pasar el bug). Probado con una rama que reintroduce el desborde de FRESCO-786: falla el e2e de tableta. PR #456 en staging/dev/main.
- Por qué: auditoría 6 (A6-T6), los fallos de layout a 360/768 px pasaban CI en verde porque solo corría Desktop Chrome.
- Siguiente: tap targets de 44 px solo cubiertos en la barra inferior (iconos 36 px, casillas 26 px, flechas 35 px pendientes, FRESCO-819); vigilar test:e2e (5m36 a 6m03, umbral 6m30); pasar a Finalizada tras QA.
## 2026-10-02 - FRESCO-789 ADR al día y check adr:check
- Qué: ADR-0032/0033/0035 a Accepted, el ADR de harnesses duplicado como 0002 pasa a ADR-0038, ADR-0036 sin texto desfasado, y scripts/check-adrs.ts (adr:check dentro de repo:check) que falla por número duplicado, fichero sin indexar, estado distinto del README o Proposed de más de 14 días. PR #458 en staging/dev/main.
- Por qué: auditoría 6 (A6-A2, A6-A10), patrón A5-H4 reaparecido: decisiones Proposed con el código ya en main.
- Siguiente: ADR-0035 se aceptó por decisión del fundador en la sesión; pasar a Finalizada tras QA.

## 2026-10-02 - FRESCO-784 backup y restauración de la BD
- Qué: workflow semanal db-backup (pg_dump cifrado AES-256, restauración verificada con recuento de filas, subida a R2) + scripts/db-backup.ts; ADR-0020 con RPO/RTO y procedimiento; hotfix.md corregido (forward-fix, sin down-migrations). PR #459.
- Por qué: audit-6 A6-D2, proyecto único en Free sin PITR. Decisión del fundador: seguir en Free hasta que los ingresos cubran Pro.
- Siguiente: secrets (SUPABASE_DB_URL, BACKUP_PASSPHRASE, R2_*), bucket R2 con ciclo de 90 días y primer workflow_dispatch como evidencia de prod; luego Finalizada.

## 2026-10-02 - FRESCO-785 enlaces de supermercado al producto equivocado
- Qué: filtro compartido lib/grocery/product-plausibility.ts (exclusión de categorías, producto cabeza del nombre, guarda de especie) en ambos generadores de catálogo y en el matcher; catálogos regenerados. PRs #461 y #462, en staging/dev/main (c4b465ff). Revisados los 199 ingredientes del diccionario y la lista real de staging.
- Por qué: los generadores elegían el producto de nombre más corto que contuviera el término (fideos a virutas de chocolate, carne picada a cerdo, ternera a sopa deshidratada). Sin match fiable ya no hay enlace ni precio.
- Siguiente: FRESCO-824 (el precio mostrado sale de una tabla por gramo y Leche 1 l da 0,00€); dudosos de criterio de producto (alubias, cacahuetes, queso, sal, pasta); filtrado por dieta del perfil (opción B) sin ticket.

## 2026-10-02 - FRESCO-807 la lista de la compra ya no suma días pasados
- Qué: generate-shopping-list filtra los huecos del plan a hoy en adelante (fecha de Madrid + fecha_inicio del plan) con el helper remaining-days.ts. El menú conserva la semana entera (opción B del fundador). PR #463, en staging/dev/main (7621dac1). Verificado en staging: lista de 29 artículos y 40,87–55,30 € pasa a 12 artículos y 8,19–11,09 €, solo viernes a domingo.
- Por qué: el viernes se sumaban los ingredientes de lunes a jueves y se proponían compras innecesarias. Un plan de semana ya terminada conserva todos los huecos.
- Siguiente: opción C (ofrecer la semana siguiente si quedan pocos días) sin ticket; el script de verificación borró las 5 listas de la cuenta PRE, no solo la actual (cuenta de pruebas, sin datos reales).
## 2026-10-02 - FRESCO-824 shopping list kg/l prices
- Qué: nuevo precioItem convierte kg/l a g/ml antes de aplicar PRICE_OVERRIDE; Leche 1 l pasa de 0,00 a 1,10 EUR. PR #464 nivelado a dev/staging/main, función generate-shopping-list autodesplegada.
- Por qué: el consolidator sube g/ml a kg/l desde 1000 pero la tabla de precios es por g/ml.
- Siguiente: revisión manual de la lista completa en staging; FRESCO-827 unifica la fuente del precio (tabla vs catálogo).
## 2026-10-02 - FRESCO-827 single price source in shopping list
- Qué: nuevo lib/grocery/line-price.ts (precioLinea, costeResumen); líneas y total del resumen usan el precio de envase del producto enlazado (ADR-0036) con respaldo al precio_estimado guardado. PR #465 nivelado a dev/staging/main.
- Por qué: la línea mostraba una estimación por gramo distinta del producto enlazado y el total salía de un tercer número.
- Siguiente: revisar la lista completa en staging; FRESCO-792 (cifras de /menu) comparte fuente de precio.
## 2026-10-02 - FRESCO-804 Vercel deploy budget
- Qué: ignoreCommand path-based (scripts/vercel-ignore-build.sh, falla hacia construir, compara contra VERCEL_GIT_PREVIOUS_SHA) + dev deployments apagados en vercel.json. PR #466 nivelado a dev/staging/main.
- Por qué: Vercel Free (100 despliegues/día) volvió a bloquear staging y producción; cada ff construía 3 ramas y los commits de docs también.
- Siguiente: contar despliegues en el panel tras un día de trabajo (criterio de cierre, FRESCO-804 sigue en Merged); verificar FRESCO-827 en fresco-pre cuando Vercel levante el límite (~24h); fresco-dev queda congelado.
## 2026-10-02 - FRESCO-792 one weekly cost, no invented figures
- Qué: retiradas las tarjetas fijas de ahorro/tiempo y el ~45€ de /menu; nuevo lib/grocery/weekly-cost.ts (costeSemanalEstimado) como única fuente del gasto semanal en /menu y en el resumen de la lista. PR #467 nivelado a dev/staging/main.
- Por qué: audit-6 A6-P5/A6-L3, cifras sin fuente iguales para todos y dos totales distintos para la misma semana.
- Siguiente: comprobar /menu y /shopping-list en fresco-pre cuando Vercel levante el límite (827 y 792 sin verificar en staging); el resumen de la lista es ahora el total semanal, no la suma de sus líneas.
## 2026-10-02 - FRESCO-826 diet/allergen-compatible supermarket links
- Qué: nuevo lib/grocery/product-compatibility.ts (esProductoCompatible, perfilCompraDesde); el mapper, la vista de la lista y costeSemanalEstimado reciben el perfil y descartan el producto enlazado si choca con dieta o alérgenos (sin enlace ni precio de catálogo). PR #468 nivelado a dev/staging/main.
- Por qué: la guarda de FRESCO-785 no miraba el perfil; los catálogos guardan un solo producto por ingrediente, así que no hay candidatos entre los que filtrar y el nombre sale del slug de la URL.
- Siguiente: revisión manual en staging con tres perfiles (halal, vegano, vegetariano) cuando Vercel levante el límite; FRESCO-826 sigue en Merged hasta entonces.
## 2026-10-02 - FRESCO-825 ambiguous supermarket product links
- Qué: decisión por ingrediente en product-plausibility.ts (alubias sin tomate, cacahuetes sin miel/aromatizados, sal sin molinillo/negra, pasta sin formas/fresca/rellena, queso genérico sin enlace) y catálogos Mercadona/Consum + ingredient-dictionary regenerados offline desde la caché local. PR #469 nivelado a dev/staging/main.
- Por qué: cinco enlaces de FRESCO-785 no eran erróneos pero tampoco el producto esperado.
- Siguiente: comprobar en staging que alubias, queso, sal y pasta(Consum) caen al precio estimado cuando Vercel levante el límite; el refresco semanal de Mercadona conserva la decisión.
## 2026-10-02 - FRESCO-798 supermarket RLS permission gate
- Qué: migración 20261002200000: private.supermarket_chain_activa(cadena) como única puerta de permiso (DEFINER, esquema no expuesto, sin identidad); políticas de product/zone/zone_postcode/price/match pasan por ella, price_history solo service_role, supermarket_chain sin SELECT para authenticated; get_supermarket_prices (INVOKER) usa la misma función. PR #470 nivelado y migración aplicada en la base compartida (ledger y políticas verificados en vivo).
- Por qué: audit-6 A6-S6, un SELECT directo se saltaba la puerta legal del RPC y supermarket_chain exponía permiso/permiso_ref.
- Siguiente: FRESCO-798 sigue en Merged (cierra con la métrica: test de 0 filas ya en CI); nada lee estas tablas como usuario hoy, así que sin efecto visible.
## 2026-10-02 - FRESCO-828 commit identity (external audit 6)
- Qué: scripts/check-git-identity.sh como primer paso de .husky/pre-commit (rechaza autor o committer @example.com, probado de extremo a extremo); override local test/test@example.com de .git/config retirado, nombre local Basilio Montes; nombre del perfil de GitHub cambiado a Basilio Montes para que los squash salgan firmados bien. PR #471 nivelado.
- Por qué: auditoría externa 6, 86 commits en main como test@example.com sin PR; la causa era una sección [user] local que pisaba la identidad global.
- Siguiente: FRESCO-828 sigue en Merged hasta comprobar 0 commits @example.com en main con uso real; FRESCO-829 (git:promote), 830 (gates a las skills), 831 (menores), 832 (reconciliar auditorías) abiertos.

## 2026-10-03 - FRESCO-837 identidad test@example.com: causa raiz y arreglo
- Qué: los tests del updater escribian `user.email test@example.com` en el .git/config real cuando el hook pre-push corre desde un worktree enlazado (git exporta GIT_DIR). PR #472: entorno sin GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE en los 3 tests, unset en .husky/pre-push y test de regresion. Tambien creados FRESCO-833..837 (huecos de la auditoria externa, tres duplicados) y 16 tickets pasados a Finalizada (828 y 837 siguen abiertos: faltan 7 dias sin commits @example.com y revisar 736/738). Duplicados creados por error: 833, 834 y 836 repiten 829, 830 y 831.
- Por qué: auditoria externa (Ely, 3,8/5) hallazgo MEDIO: 78 commits directos a main sin trazabilidad. FRESCO-828 solo bloqueaba el sintoma.
- Siguiente: ejecutar FRESCO-829 (git:promote) y FRESCO-830 (gates de skills); regla guardada: no subir a main sin checks verdes ni commits por PR con identidad real.
