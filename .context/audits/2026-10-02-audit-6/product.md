# Auditoría 6, eje Producto/negocio (2026-10-02)

Rúbrica v1, solo lectura. Verificado contra código, ADRs, `.context/` y Jira en vivo (REST + acli). No se consultó PostHog en vivo (ver A6-P9).

## Nota: **2,5 / 5** (igual que audit-5)

Hallazgos: **1 BLOCKER, 6 ALTO, 5 MEDIO, 3 BAJO** (15 en total).

Por qué no sube: se arreglaron A5-H7 y A5-B3 de verdad, pero el B1 legal se cerró por decreto sin evidencia, se aceptó conscientemente usar datos de Consum contra sus términos, y el copy de Pro sigue prometiendo comportamiento que el código no tiene. Sigue sin haber cohorte ni métrica medida.

---

## BLOCKER

### A6-P1 · FRESCO-434 (revisión legal) cerrado como Finalizada sin evidencia; los entregables de la checklist de ingeniería siguen sin hacerse
- Evidencia Jira: FRESCO-434 pasó a `Finalizada` el 2026-09-29 "por decisión del fundador, que indica que el texto legal ya ha sido revisado. Sin evidencia adjunta". El único trabajo anterior en el ticket es una revisión hecha por una IA ("no un abogado colegiado", comentario 2026-09-08). Es exactamente lo que `definition-of-done.md` prohíbe (fila "Decisión/deferral": no va a Finalizada, y el cierre exige evidencia). El hallazgo B1 de audit-5 no se resolvió, se cerró administrativamente.
- Evidencia código (`.context/legal/FRESCO-434-brief-abogado.md` §5, verificado con rg): siguen sin existir la casilla de edad 14+ (los Términos lo declaran pero no se comprueba), la aceptación de Términos/Privacidad en la vía de invitado/onboarding (solo existe en `/signup`), el consentimiento explícito Art. 9 para alergias, el resumen precontractual/desistimiento antes del checkout (`components/profile/upgrade-to-pro-button.tsx` no lo tiene) y el registro de versión de textos aceptada.
- `LEGAL_ENTITY` (`components/legal/legal-content-data.ts`) afirma "Basilio Montes Castaño, autónomo, NIF…" mientras el propio brief (§3) dice que el alta como autónomo "hoy [está] pendiente". Texto contractual con una afirmación falsa, y `/api/stripe/checkout` ya acepta cobros.
- Severidad BLOCKER condicionada a que se cobre a un usuario real. El endpoint de checkout ya está operativo, así que el único freno es de proceso, y el proceso acaba de saltarse.
- Fix: reabrir 434 (o abrir ticket hijo) con criterio de salida "informe/correo del abogado adjunto"; hasta entonces desactivar el CTA de checkout con flag. Implementar los 5 ítems de §5 (no dependen del abogado, salvo los textos). Corregir "autónomo" hasta el alta real en RETA/Hacienda.

## ALTO

### A6-P2 · Consum y Mercadona: uso consciente de datos contra términos expresos, sin dictamen
- `.context/ADR/ADR-0037-consum-catalog-risk-accepted.md` (Accepted 2026-10-01): "knowingly operating against a stated term". Consum no ha respondido (solicitud 2026-09-29, plazo ~2026-10-06, FRESCO-764). `lib/grocery/supermarket/catalog-connectors.ts:174` registra `consum` como `riesgo-aceptado`. El generador (`scripts/gen-consum-catalog.ts`) llama directamente a `tienda.consum.es/api`, más expuesto que Mercadona según el propio ADR.
- El ADR admite que citó los términos de Consum "desde un extracto de búsqueda, no leído de punta a punta"; la decisión se tomó antes de verificar el texto.
- Mercadona (ADR-0028): el dataset `datania/mercadona-catalog` es MIT (verificado con `gh api`), pero esa licencia cubre el código del repo, no los derechos sobre los datos de Mercadona (derecho sui generis de bases de datos y cláusula de consentimiento escrito). No hay constancia en `.context/` de la licencia ni de esta distinción. Que el refresco "no haga peticiones a Mercadona" no cambia la cláusula de reproducción.
- La app muestra precios y enlaces de ambas cadenas en producción (`components/shopping-list/shopping-list-view.tsx`), y los Términos/Privacidad no mencionan datos de terceros ni exoneran la exactitud de los precios.
- Respuesta a la pregunta clave: sí, se usan datos de Consum sin consentimiento, por decisión registrada. El gate de `permiso` funciona tal como se diseñó (ADR-0036), pero un `riesgo-aceptado` autoconcedido es un gate que el propio fundador puede abrir sin tercero.
- Fix: kill-switch documentado y probado (una línea en `registry.ts`, ya descrito); dictamen breve de abogado sobre bases de datos antes de lanzar públicamente; añadir cláusula "precios orientativos, fuente y fecha" en la UI y en Términos; no ejecutar FRESCO-772 (conector en vivo) hasta tener respuesta de Consum.

### A6-P3 · La landing vende un aprendizaje que no existe (sección "Solo en Pro")
- `components/landing/learns-pro.tsx`: Semana 4: "Vimos que siempre descartas el pescado los miércoles. Esta semana, nada de pescado." Semana 8+: "Rara vez descartas algo". Semana 2: "Sin recetas de la semana pasada. **Sin que tengas que decir nada.**"
- Código real (`supabase/functions/generate-meal-plan/index.ts:131-160`, `prompt.ts:32-58`): el "aprendizaje" es (a) excluir recetas **marcadas** cocinada/descartada en las últimas 2 semanas (`p_weeks: 2`) y (b) un empujón por conteo de engagement. No hay patrón por día de la semana ni por categoría, y sin marcas explícitas no hay exclusión alguna (el comentario FRESCO-120 lo confirma). "Sin que tengas que decir nada" es falso: requiere marcar.
- Es la misma familia que A4-H11 y A5-H7, que se limpió en `pricing.tsx` pero no en esta sección ni en su ejemplo concreto. Es el moat declarado del producto y el motivo del pago.
- Fix: reescribir la línea de tiempo con comportamiento verificable ("Marca lo que cocinas y descartas; la semana siguiente no vuelven"), quitar la cita del pescado y "Rara vez descartas algo", o construir esa señal antes de prometerla. Añadir un test de copy vs feature (lista de claims y archivo que los respalda).

### A6-P4 · "Sin repetir" se presenta a todos, pero Free nunca excluye recetas recientes
- `components/landing/impact-stats.tsx`: "Sin repetir. No vuelven las recetas de las últimas semanas. En Pro, además aprende…" implica que Free tampoco repite.
- `generate-meal-plan/index.ts:105-110,131`: `recentRecipeIds` solo se rellena si `isPro`; el comentario dice "Free stays a single line… never excludes anything". Y `pricing.tsx` lo lista como característica de Pro, contradiciendo la sección anterior de la misma página.
- Fix: decidir qué es verdad (probablemente "solo Pro") y alinear ImpactStats; si se quiere que Free no repita, es un cambio de producto (y de la propuesta de valor del plan de pago).

### A6-P5 · Cifras inventadas siguen en la app (residuo de A4-H13/H16)
- `components/menu/savings-estimate-cards.tsx` + `app/(app)/menu/page.tsx:163,262`: "~15€ Ahorro orientativo" y "~3h Tiempo recuperado" fijos para todos los usuarios, sin fuente y con el aviso eliminado (FRESCO-75). El propio comentario admite que son placeholders sin respaldo. La landing sí se limpió (FRESCO-370) por "no existe tal fuente", pero la misma cifra sigue en `/menu`, la pantalla de valor principal.
- Riesgo: práctica comercial engañosa en producto de pago; contradicción interna con la decisión ya tomada para la landing.
- Fix: quitar los dos tiles o sustituirlos por valores calculados (el primero ya lo está con `estimateMenuCost`).

### A6-P6 · Datos de salud (alergias): el consentimiento Art. 9 no es explícito donde se recogen
- `legal-content-data.ts` "Base Legal para Datos de Alergias": consentimiento "otorgado al introducirlos en tu perfil". Verificado: `components/onboarding/onboarding-step-diet.tsx` no tiene ningún texto/casilla de consentimiento (rg "consentimiento|salud" sin resultados en onboarding). El invitado genera menú sin aceptar nada (brief §5).
- Un consentimiento implícito no cumple 9.2.a RGPD ("explícito"). Es dato de categoría especial en el flujo núcleo.
- Fix: casilla/texto explícito, no premarcado, en el paso de dieta, más registro con versión y fecha.

### A6-P7 · La métrica de éxito del MVP sigue sin ser medible ni medida
- Verificado: `mvp-scope.md` fue corregido (A5-B3 cumplido) y reconoce que no hay cohorte. FRESCO-330 (refuerzo del moat) sigue como epic `[DRAFT]` en `Listo`. FRESCO-434 (cobro real) acaba de cerrarse, pero no hay constancia de cohorte alguna.
- La barra "3 de 10 pagan y repiten 3+ semanas" depende de eventos de cliente de PostHog que solo se emiten con consentimiento de cookies (`posthog-provider.tsx`), con sesgo de selección; no hay consulta SQL de respaldo sobre `meal_plans`/Stripe ni dashboard como código. ADR-0013 promete retención "sin cohort SQL", lo cual solo es válido para quienes aceptan cookies.
- Estado de eventos del funnel (verificado en `lib/posthog/event-names.ts`): landing_cta, guest_started, user_signed_up, otp_*, onboarding_started/step/completed/abandoned, menu_generation_started/completed, recipe_marked_cooked/discarded, shopping_list_generated, checkout_started, trial_started, trial_converted_to_paid, subscription_renewed/cancelled, push_*. Cubre onboarding, menú, cocinar y upgrade. Faltan `payment_failed` y un evento de "plan degradado a Free" (reversión de trial/cancelación por impago) para cerrar el ciclo de churn.
- No consulté PostHog en vivo: no verifico volumen real, ni si hay usuarios reales hoy.
- Fix: ticket "medición del bar" con una consulta SQL reproducible (usuarios con `plan_id` de Stripe de pago y semanas consecutivas con plan con estado cocinada) guardada en repo; evento de churn por impago.

## MEDIO

### A6-P8 · Evidencia de cierre (DoD) débil en tickets recientes
- De 60 tickets cerrados en los últimos 5 días (Historia/Tarea/Error), 15 tienen 0 comentarios (25%) y 0 adjuntos prácticamente en todos (solo FRESCO-723 tiene 2). Incluye los hallazgos de audit-5: FRESCO-735, 736, 737, 738 (gate de `/admin/recipes`) con descripción vacía y sin comentario de verificación; 729-734 con un solo comentario y descripción vacía. El hallazgo anterior (FRESCO-392) era precisamente este patrón.
- Además FRESCO-745 ("mitigación de cookie sin httpOnly") se cerró con descripción vacía mientras FRESCO-749/750 (limitar/activar timebox de sesión) siguen abiertos (Rechazos/Blocked).
- Fix: validación automática de cierre (hook/automación que exija comentario con evidencia para Error y Tarea de auditoría), y revisión retroactiva de 735-738.

### A6-P9 · Eventos del servidor sin puerta de consentimiento
- `lib/posthog/server.ts` + `app/api/stripe/webhook/route.ts:162,292,339` y `supabase/functions/send-weekly-reengagement-push` capturan eventos con el `user.id` real sin comprobar consentimiento. La Política de Privacidad dice "con tu consentimiento, recogemos eventos de uso". Puede defenderse como necesario para el contrato, pero no está declarado así.
- Fix: declarar en Privacidad que los eventos de facturación/push se tratan por interés legítimo/contrato, o gatearlos.

### A6-P10 · Stripe: trial sin tarjeta con comportamiento de fin de trial implícito; plan anual sin código
- `app/api/stripe/checkout/route.ts`: `trial_period_days: 7` + `payment_method_collection: 'if_required'`, sin `trial_settings.end_behavior.missing_payment_method`. No he verificado el comportamiento por defecto de Stripe aquí; conviene fijarlo explícitamente (cancelar) y cubrirlo con la suite `@requiere-stripe-real` (que sigue sin CI, FRESCO-735 la cerró como hallazgo sin wiring visible).
- Solo existe `STRIPE_PRICE_ID_PRO_MONTH` en el código (checkout, webhook, reconcile). La memoria del proyecto menciona variables de plan anual en `.env` (no verificado, por regla no se leyó `.env`); si existen, son config muerta o falta la oferta anual. Precio coherente en landing/profile/JSON-LD/final-cta (4,99 €/mes).

### A6-P11 · Drift de documentación
- `business-data-map.md` (última edición 2026-09-03) no recoge las 7 tablas `supermarket_*`/`ingredient_product_match` de la migración `20261001180000` (cero coincidencias), `business-feature-map.md` (09-03) no incluye ADR-0036/0037 ni la capa de supermercado, `epic-tree.md` (09-07) no tiene ningún FRESCO-7xx, `master-implementation-plan.md` (08-31) previo al giro de ADR-0027, `user-journeys.md` (07-26). `dev-roadmap.md` (09-25) sí cita FRESCO-7xx.
- Fix: refresco de mapas tras cerrar la capa de supermercado (regla 17 de AGENTS ya lo cubre como disparador de epic).

### A6-P12 · Salud del backlog en Jira
- 742 tickets, 54 abiertos (7%). Estados abiertos: 21 en `Rechazos` (usado como aparcamiento, incluye bugs reales sin resolver: FRESCO-124 receta con nombre vacío en producción sin CHECK, abierto desde 2026-09-01; FRESCO-712 grid semanal cortado en Android 360px; FRESCO-183; Epic FRESCO-138 y sus 9 hijas sin tocar desde 2026-08-09), 1 en WIP (**FRESCO-31**, fotos 579/1000, sin actualizar desde 2026-09-15, 17 días), 11+ `Blocked` (cadena de supermercado esperando a terceros) y resto `Listo` (mayormente ideas `[DRAFT]` que inflan el estado "listo").
- 168 de 268 Historias (63%) no tienen epic padre (todas Finalizada, retrofit de escenarios QA/aceptación), lo que rompe la jerarquía Epic → Historia.
- Estimaciones: ninguno de los 54 abiertos tiene `timeoriginalestimate`; no verifiqué otro campo de puntos.
- Fix: cerrar o reencuadrar Rechazos de bugs reales (124, 712); mover FRESCO-31 a Blocked/Rechazos con razón; agrupar las 168 historias en epics de cobertura.

## BAJO

### A6-P13 · NIF personal publicado y contacto en Gmail
`LEGAL_ENTITY` publica el NIF de una persona física y solo la localidad (hueco LSSI documentado por el fundador, aceptado). Contacto `hola.frescoapp@gmail.com` (dependiente de dominio propio, ya conocido).

### A6-P14 · Onboarding de 4 pasos frente al PRD de 3
FRESCO-755 añade un resumen (`step === 4`) tras los 3 pasos de datos; PRD US 1.2 dice "3 steps only". Aceptable, pero el PRD no refleja la excepción.

### A6-P15 · `Listo` agrupa epics DRAFT
FRESCO-244, 331, 330, 529 y 10 historias `[DRAFT]` (339, 335, 341, 342, 343, 338, 347-350, 344) figuran `Listo` aunque son ideas aparcadas por el blacklist (escaneo de tickets, inventario de despensa, B2B). Etiqueta/estado distinto para backlog de ideas.

---

## Positivos (verificados)

- A5-H7 corregido: `pricing.tsx` ya no promete el recordatorio inexistente y documenta el porqué (FRESCO-737).
- A5-B3 corregido: `mvp-scope.md` dice con claridad que la barra NO se alcanzó (honestidad documental).
- Precio y trial consistentes en todas las superficies; checkout y webhook con eventos de embudo en servidor.
- Landing limpia de "IA" (rg sin coincidencias), sin cifras inventadas (FRESCO-370), FAQ alineada con el producto.
- Rutas legales públicas `/legal/{terminos,privacidad,cookies,contacto}` ya existen (FRESCO-493 resuelto), banner de cookies con gate real de PostHog y cuatro filas de la tabla de cookies verificadas contra código.
- Cobertura de eventos del embudo muy completa (onboarding por paso, abandono, OTP, guest, checkout/trial/renovación/cancelación, push).
- La capa de supermercado tiene un gate de permisos ejecutable (ADR-0036, `puedeEjecutarse`) y ADRs explícitos, a diferencia de un scraping silencioso.
- Política de privacidad detallada: encargados, transferencias, base legal por finalidad, plazo de conservación, derechos y AEPD.
- Jira: ADR y definition-of-done existen y el cierre de tickets de capa de supermercado (762, 760, 520, 521) sí lleva comentarios y enlaces.

## Regresiones de audit-4/5 (productos)

| Hallazgo previo | Estado hoy |
|---|---|
| A5-B1 legal (FRESCO-434) | **Regresión de proceso**: cerrado sin evidencia (A6-P1) |
| A5-B3 métrica MVP | Corregido en doc; medición sigue sin existir (A6-P7) |
| A5-H7 promesa no construida | Corregido en `pricing.tsx`; la misma familia sigue en `learns-pro.tsx` (A6-P3) |
| A4-H11 Pro honesto | Parcial (pricing sí, learns-pro/impact-stats no) |
| A4-H13/H16 cifras inventadas | Landing OK; **residuo en `/menu`** (A6-P5) |
| A4-H10 lista automática | OK |
| A4-H14 onboarding 3 pasos | OK (+resumen, BAJO) |
| A4-M24 analytics de invitados | OK (`guest_started`) |
| A4-H17 trazabilidad de defectos | Sin muestra completa; ver A6-P8 y A6-P12 |
| A4-M26 drift de cifras en mapas | Reaparece (A6-P11) |
