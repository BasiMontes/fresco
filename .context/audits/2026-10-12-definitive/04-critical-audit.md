# Auditoría crítica independiente (2026-10-12): 3,4/5

> Pasada adversarial sobre la app tal y como está hoy (`main` en `f4a93ab`, rama de trabajo `perf/FRESCO-906-exclude-sharp`). Solo lectura. Rúbrica v1 (la de las auditorías 3-6, ver `../README.md`).
> Método: lectura de código con evidencia `fichero:línea`, consultas `SELECT` y advisors sobre el proyecto Supabase enlazado (`jdqemhewjrjuopssdurn`), `gh run list`/`gh issue list` de solo lectura, `curl -I` a producción, `bun audit`. No se ha ejecutado ningún exploit, ni migración, ni despliegue, ni escritura en Jira/GitHub. Los títulos de auditorías previas se han mirado solo para no duplicar; cada hallazgo se ha vuelto a comprobar en el estado actual.

## Veredicto

La seguridad de base está mucho mejor que en audit-6: RLS activo en las 21 tablas de `public`, `anon` solo lee `recipes` e `ingredient_substitutions`, los `SECURITY DEFINER` tienen `search_path` fijo y `EXECUTE` recortado, el webhook de Stripe verifica firma e idempotencia, y hay backup semanal restaurado y subido a R2. Lo que queda **no está en el perímetro, sino en las rutas de dinero y en la promesa de seguridad alimentaria**: dos hallazgos BLOCKER que ninguna auditoría anterior recogía, ambos verificados con datos y código reales.

| Eje | Nota | BLOCKER | ALTO | MEDIO | BAJO |
|---|---|---|---|---|---|
| Seguridad (RLS, RPC, edge, headers) | 4,0 | 0 | 0 | 3 | 3 |
| Integridad de datos, dinero y seguridad alimentaria | 2,5 | 2 | 3 | 1 | 1 |
| Arquitectura y capas | 4,3 | 0 | 0 | 0 | 0 |
| Calidad de tests | 3,5 | 0 | 1 | 1 | 1 |
| CI/CD y operaciones | 3,3 | 0 | 0 | 2 | 1 |
| Rendimiento | 3,8 | 0 | 0 | 1 | 0 |
| Legal / RGPD | 2,8 | 0 | 2 | 4 | 0 |
| **Total (media 3,4)** | **3,4** | **2** | **6** | **12** | **6** |

Total: 26 hallazgos (2 BLOCKER, 6 ALTO, 12 MEDIO, 6 BAJO). C-26 se añadió después de la pasada original, a raíz de una pregunta sobre el captcha. La media sube 0,2 frente a audit-6 (3,2) porque casi toda la lista de seguridad de audit-6 está realmente cerrada; no sube más porque los dos BLOCKER son de las rutas que más daño hacen el día del lanzamiento. Las notas no son comparables con las de la 6 externa (otra lente).

## Tabla resumen

| ID | Sev. | Eje | Resumen |
|---|---|---|---|
| C-01 | BLOCKER | Dinero/RGPD | Borrar la cuenta no cancela la suscripción de Stripe: se sigue cobrando a quien ya no existe |
| C-02 | BLOCKER | Seguridad alimentaria | ~26 recetas con lácteo sin etiqueta `lactosa`, 4 recetas con jamón marcadas `halal`, 1 con trigo marcada `sin_gluten` |
| C-03 | ALTO | Dinero | Webhook: un evento reclamado cuyo proceso muere queda "ya procesado" y el cron no lo puede curar |
| C-04 | ALTO | Dinero/Ops | Entorno compartido: un usuario real que toque staging queda con IDs de Stripe de modo test y su checkout en producción falla para siempre |
| C-05 | ALTO | Tests | El e2e semanal contra Stripe real está en rojo (4 de las últimas 6 ejecuciones); la ruta de cobro no tiene verificación verde |
| C-06 | ALTO | RGPD | Exportación incompleta y supresión incompleta (favoritos, consentimientos, push, PostHog, Stripe) |
| C-07 | ALTO | Legal/Ops | Cobrar en Vercel Hobby (uso no comercial), Supabase Free sin PITR, autónomo sin alta, textos legales provisionales |
| C-08 | ALTO | Seguridad alimentaria | Vocabulario de alérgenos de 12 de los 14 de la UE: mostaza y altramuces no se pueden declarar ni filtrar |
| C-09 | MEDIO | Integridad | `generate-meal-plan` no es atómico y no valida `semana_iso`/`fecha_inicio`; ya hay 1 plan huérfano en la BD |
| C-10 | MEDIO | Seguridad | `user_profiles` sin límites de tamaño en texto/arrays/JSONB: abuso de almacenamiento por invitados |
| C-11 | MEDIO | Ops | `pg_cron` marca "succeeded" aunque el HTTP falle y la respuesta de `pg_net` caduca en horas: el fallo del cron de Stripe es invisible |
| C-12 | MEDIO | Tests | Cobertura "honesta" 49,6 % frente al 87 % de cabecera; el suelo honesto es 49,0 |
| C-13 | MEDIO | RGPD | Consentimiento Art. 9 (alergias) solo en UI: nada del servidor lo exige |
| C-14 | MEDIO | RGPD | Lista de encargados incompleta: faltan Resend, Cloudflare Turnstile y el SMTP de Google |
| C-15 | MEDIO | RGPD | Eventos de PostHog desde servidor con el ID del usuario, también si rechazó cookies |
| C-16 | MEDIO | Rendimiento | El CSP con nonce vuelve dinámica cualquier página, landing y legales incluidas: sin caché de CDN en Hobby |
| C-17 | MEDIO | Ops | Backup semanal: RPO hasta 7 días; sin PITR; el simulacro de restauración es manual |
| C-18 | MEDIO | Seguridad | Protección de contraseñas filtradas desactivada en el proyecto alojado (advisor WARN) |
| C-19 | MEDIO | Legal | Datos de Mercadona y Consum en producción con "riesgo aceptado" (ADR-0028/0037), sin dictamen |
| C-26 | MEDIO | Seguridad | Captcha no verificado en el servidor de Auth (un solo proyecto para todos los entornos) y `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` en Vercel (FRESCO-907) |
| C-20 | BAJO | Seguridad | `/api/health` publica el SHA y el entorno; `/qa` es pública en producción con el contrato de las Edge Functions |
| C-21 | BAJO | Seguridad | `POST /api/waitlist` sin límite de ritmo ni captcha |
| C-22 | BAJO | Dinero | Trial sin tarjeta repetible creando cuentas nuevas (solo queda el límite por cuenta) |
| C-23 | BAJO | CI | `dependency-audit` en rojo (1 high solo de tooling, 1 low) y PRs de Dependabot fallando: ruido que enseña a ignorar el rojo |
| C-24 | BAJO | Ops | Cadencia de despliegues: 18 deploys hoy (4 a producción) y 30 ayer frente al tope de 100/día |
| C-25 | BAJO | Seguridad | El catálogo completo de recetas es legible por `anon` (RLS `true`) y raspable |

## BLOCKER

### C-01: borrar la cuenta no cancela la suscripción de Stripe
- **Evidencia.** `supabase/functions/delete-account/index.ts:92` solo llama a `serviceClient.auth.admin.deleteUser(user.id)`. La función no importa Stripe (`rg -i stripe supabase/functions/delete-account` no devuelve nada). El cliente (`components/profile/delete-account-dialog.tsx`, `danger-zone.tsx`) tampoco cancela ni avisa del portal. El borrado en cascada elimina `user_profiles`, y con él `stripe_customer_id` y `stripe_subscription_id`.
- **Escenario de fallo.** Una usuaria Pro con tarjeta (ya pasado el trial) elimina su cuenta. Stripe sigue con la suscripción viva y cobra 4,99 EUR cada mes a alguien sin cuenta en Fresco. Los webhooks `invoice`/`subscription.updated` llegan, `findProfileByStripeCustomer` no encuentra fila y solo se escribe un `console.error`. El cron de reconciliación solo recorre perfiles con `stripe_subscription_id` (`lib/billing/reconcile.ts:25-30`), así que nunca la ve. Resultado: cobro sin servicio, contracargo, y un incumplimiento del Art. 17 RGPD (el dato de pago sigue activo) y del TRLGDCU.
- **Matiz.** Hoy no hay usuarios de pago (`user_profiles` con `plan <> 'free'`: 0). Es BLOCKER de lanzamiento, no incidente actual.
- **Fix.** Antes de `deleteUser`, la ruta (o una función Next con Stripe) cancela la suscripción (`stripe.subscriptions.cancel`) y borra o anonimiza el cliente; solo si Stripe confirma se borra la cuenta. Si Stripe falla, la función responde error y no borra. Añadir test de integración con Stripe mockeado y el escenario `@requiere-stripe-real`.

### C-02: etiquetas de alérgenos y dieta incorrectas en el catálogo activo
- **Evidencia (consulta `SELECT` a `recipes` con `activo`, 538 recetas).** El filtro de seguridad es una comparación de etiquetas (`supabase/migrations/20260901073555_allergen_filter_safety_net.sql`, función `get_filtered_recipes`), así que su exactitud depende solo de que `recipes.alergenos` y `recipes.dieta` sean correctos. Cruzando con `ingredientes_principales`/`ingredientes_cantidades`:
  - **Lácteo sin `lactosa`:** 26 recetas, entre ellas *Lasaña de verduras* (queso mozzarella, alérgenos `["gluten"]`), *Sándwich de pavo y queso*, *Tostada integral con tomates cherry*, *Yogur griego con miel y nueces*, *Bol de yogur griego con granola*, *Bol de requesón con fresas*, *Crema de espinacas y queso*, *Risotto de setas*, *Moussaka de berenjena*, *Croissant con jamón y queso*, *Arepa rellena de queso*. (Excluidas las bebidas vegetales y el coco para no inflar la cifra.) Existe una variante *Lasaña de verduras* con bechamel que sí lleva `lactosa`: el etiquetado es inconsistente entre recetas casi iguales.
  - **`halal` con cerdo:** *Tostada con tomate y jamón serrano*, *Croissant con jamón y queso*, *Revuelto de champiñones y jamón*, *Tostada francesa salada con jamón* tienen `dieta.halal = true`. Otras tres (*Mejillones al vapor*, *Conejo al ajillo*, *Ternera guisada*) llevan vino/alcohol en la lista y también `halal = true`.
  - **`sin_gluten` con trigo:** *Wrap de pollo* (`tortilla de trigo`) tiene `sin_gluten = true` y `alergenos = []`.
- **Escenario de fallo.** Una persona con alergia a la proteína de la leche marca el chip "Lactosa" en el onboarding; el generador le coloca *Sándwich de pavo y queso* o *Lasaña de verduras* en la cena. Una celíaca con la dieta "sin gluten" recibe el *Wrap de pollo*. Un usuario halal recibe un bocadillo de jamón. Es la promesa central del producto (ADR-0001, NFR-SEC-3) y el filtro "falla cerrado" solo si los datos son correctos. Nada en CI lo detecta: el `CHECK recipes_alergenos_vocab` valida el vocabulario, no la coherencia con los ingredientes.
- **Matiz.** Con la dieta `sin_lactosa` activada el problema no aparece (esas recetas tienen `sin_lactosa = false`); el hueco es el chip de alérgeno. No se ha mirado una por una todas las 538 recetas: la lista es lo que un regex conservador encuentra, así que es un mínimo.
- **Fix.** (1) Migración de datos que corrija las ~30 recetas y cree una vista de auditoría. (2) Test de datos en `tests/db/` que falle si un ingrediente de una tabla de palabras clave (lácteos, gluten, frutos de cáscara, cerdo, alcohol) aparece sin su etiqueta, con lista de excepciones explícita (leche de coco). (3) Derivar `dieta.*` de las etiquetas, no declararlas a mano. (4) Revisión humana del 100 % de las recetas con alérgeno antes del lanzamiento.

## ALTO

### C-03: evento de Stripe reclamado y no completado queda irrecuperable
- **Evidencia.** `app/api/stripe/webhook/route.ts:98-115` reclama `event.id` con un `INSERT` antes de procesar y `134-146` devuelve 200 aunque el proceso falle (libera el claim con `releaseWebhookEvent`). Si la función de Vercel muere entre el claim y el release (timeout, OOM, corte por despliegue), el claim queda en `stripe_webhook_events` (`supabase/migrations/20261007150000_stripe_webhook_events.sql`; la columna `processed_at` se escribe al reclamar, no al terminar). Los reintentos de Stripe se saltan como "already processed" (`route.ts:111-114`). `checkout.session.completed` es el único evento que escribe `stripe_subscription_id`, y el cron solo repara perfiles que ya lo tienen.
- **Escenario.** Una usuaria paga; el evento se reclama; la función se corta antes de `activateProPlan`. Stripe no reintenta con efecto, el cron no la ve (sin `stripe_subscription_id`), y queda cobrada y en Free hasta que alguien lo note.
- **Fix.** Estado explícito (`claimed_at`, `completed_at`); reclamo caducable (p. ej. >5 min sin `completed_at` se puede retomar); y en el cron, un barrido inverso: sesiones `checkout.session` pagadas de las últimas 48 h sin Pro en BD (`stripe.checkout.sessions.list` + `client_reference_id`).

### C-04: entorno compartido más Stripe de modo test: el checkout de un usuario real puede romperse de forma permanente
- **Evidencia.** `.agents/project.yaml` (líneas 220-232) declara el mismo `db_project_ref` para local, dev, staging y producción; ADR-0020 lo acepta "hasta Pro". `app/api/stripe/checkout/route.ts:109` reutiliza `profile.stripe_customer_id` en `customer:`; `lib/legal/pro-terms.ts` hace que cualquier ID previo marque el trial como gastado.
- **Escenario.** Una usuaria real (cuenta única, mismo Supabase) abre `fresco-pre`, que usa Stripe en modo test, y hace el checkout de prueba: su perfil guarda un `cus_...` de test. Al día siguiente, el cron de producción (clave live) recupera esa suscripción: `resource_missing`, la baja a Free. Cuando intenta pagar de verdad en producción, el checkout envía `customer: cus_test…` con clave live y Stripe responde "No such customer": error 500 "No se pudo iniciar el pago" cada vez, y además ya no tiene trial. Sin soporte ni herramienta que limpie esos IDs.
- **Fix.** Separar proyecto Supabase de producción (el salto a Pro del plan ya está previsto en ADR-0020) antes de cobrar. Mientras tanto, guardar el modo de Stripe con el ID (`livemode`) y descartar en el checkout cualquier `customer` que no sea del modo actual; y bloquear el checkout de Stripe test sobre cuentas que no sean de prueba.

### C-05: la única prueba real de cobro está en rojo
- **Evidencia.** `gh run list --workflow stripe-e2e.yml`: de las últimas 6 ejecuciones, 4 fallan (2026-10-12 14:27 programada, 10:22, 10:18 manuales; 10-07 dos); issue abierta #610. El último log: `Expected: "price_1U5pTQ…"`, `Received: "price_1UNAw9…"` en el escenario "Contratación de Pro con cobro anual": el ID del precio anual que llega al checkout de staging no coincide con el que espera el test. Eso apunta a deriva entre el secreto de CI y la variable de Vercel (o a un precio equivocado servido en `fresco-pre`).
- **Escenario.** El día del lanzamiento el cobro anual usa un precio que nadie ha verificado, o el test se silencia por costumbre. Es la ruta de ingresos.
- **Fix.** Resolver la deriva (un único origen del precio: Stripe lookup key en lugar de IDs en variables), dejar `stripe-e2e` en verde y convertirlo en condición previa de cualquier promoción a `main` mientras exista cobro.

### C-06: derechos de acceso/portabilidad y supresión incompletos
- **Evidencia.** `lib/api/profile-export.ts:18-24` exporta solo `user_profiles`, `meal_plans`(+slots), `shopping_lists`, `recetas_propias`. Quedan fuera `favorites`, `user_consents`, `push_subscriptions` (el endpoint es un dato personal) y el correo. Supresión: `delete-account` cascada solo `auth.users`; no borra la persona en PostHog (distinct id = id de usuario, `app/api/stripe/webhook/route.ts:188-195`) ni el cliente de Stripe (C-01), ni se avisa a Resend/Sentry. `docs/workflows/environments.md` es lo único que menciona borrado de PostHog.
- **Escenario.** Una petición Art. 15/17 recibe un CSV que omite datos y, tras la baja, siguen existiendo la persona de PostHog con `plan`, el cliente de Stripe y los eventos. Sanción tipo AEPD por incumplimiento de plazo/alcance.
- **Fix.** Ampliar el export a todas las tablas con `user_id` (`favorites`, `user_consents`, `push_subscriptions`) más el correo. Al borrar: llamada a la API de borrado de personas de PostHog, borrado del cliente de Stripe, y registro de la supresión.

### C-07: marco operativo y legal de lanzamiento
- **Vercel Hobby con cobros.** El plan Hobby es solo de uso personal no comercial; cobrar una suscripción lo incumple (los topes que ya han golpeado, 100 deploys/día y 10 GB de almacenamiento, son la consecuencia). Evidencia: `.agents/project.yaml` (límite Free de 100 deploys/día) y la nota de memoria del cap de Functions Storage.
- **Supabase Free.** `get_organization` devuelve `plan: free`: sin PITR ni copias gestionadas (solo el backup semanal propio, C-17) y con pausa por inactividad.
- **Autónomo sin alta.** `lib/legal/entity.ts:4`: "Founder has not registered as autónomo (RETA/Hacienda) yet" mientras se publica el NIF y se plantea cobrar. Sin alta no hay base legal para facturar ni cuenta de Stripe limpia.
- **Textos provisionales.** `lib/legal/consent.ts:19`: `LEGAL_TEXTS_VERSION = 'provisional-2026-10-06'`; el dictamen legal (FRESCO-434) se cerró sin evidencia en audit-6 y el contacto sigue siendo un Gmail.
- **Fix.** Puerta de lanzamiento explícita: pasar a Vercel Pro y Supabase Pro (PITR, protección de contraseñas filtradas, entorno separado, ver C-04 y C-18), alta de autónomo, y revisión legal firmada con adjunto en Jira. El fundador ha fijado "sin gasto por ahora": esto debe quedar escrito como condición de "empezar a cobrar", no como tarea suelta.

### C-08: 12 de los 14 alérgenos de la UE
- **Evidencia.** `supabase/migrations/20260901073555_allergen_filter_safety_net.sql:22-24` documenta "Known gap": `mostaza` y `altramuces` no están etiquetados "ni hay datos fuente". El `CHECK recipes_alergenos_vocab` los impide en el catálogo y `lib/constants/dietary-options.ts` no los ofrece. En la BD hoy no hay recetas con esos ingredientes (`mostaza_any = 0`, `altramuz_any = 0`), así que el filtro no se equivoca hoy, pero la app no deja declarar esas alergias.
- **Escenario.** Una persona alérgica a la mostaza (Reglamento UE 1169/2011) no puede declararlo; cualquier receta futura con mostaza (vinagretas, salsas) entraría sin filtro. La app no avisa de que esos dos alérgenos no están cubiertos.
- **Fix.** Añadir ambos al vocabulario y a las opciones, etiquetar el catálogo (empieza por una búsqueda de `mostaza` en `ingredientes_cantidades` y salsas) y mostrar en el onboarding un aviso claro de qué alérgenos cubre la app y cuáles no.

## MEDIO

### C-09: generación del menú no atómica y sin validación de la semana
- **Evidencia.** `supabase/functions/generate-meal-plan/index.ts`: lee `semana_iso` y `fecha_inicio` solo con comprobación de presencia (líneas ~59-62); inserta `meal_plans` y después, en otra llamada, `meal_plan_recipes`, con un `delete` compensatorio si la segunda falla (~232-248). Un corte entre ambas deja un plan sin slots, y el índice `unique_user_semana` hace que ese plan bloquee regenerar esa semana (la función responde 409 "Elimínalo antes de regenerar"). En la BD: 18 planes, **1 sin slots**. Sin `CHECK` en `meal_plans` sobre el formato de `semana_iso`, un usuario puede guardar cualquier texto o semanas arbitrarias (5 por hora).
- **Fix.** Una función SQL `create_meal_plan(...)` transaccional que valide `semana_iso ~ '^\d{4}-W\d{2}$'` y `fecha_inicio` coherente, y que el generador llame con service role. Limpiar el plan huérfano existente.

### C-10: sin límites de tamaño en `user_profiles`
- **Evidencia.** Las únicas restricciones (`information_schema`/`pg_constraint`) son de rangos numéricos. `alergenos`, `ingredientes_odiados`, `ingredientes_favoritos`, `*_texto_libre`, `nombre` y `planning_selection` (JSONB) no tienen límite de longitud ni de cardinalidad. `meal_plans`, `shopping_lists` y `recetas_propias` sí los tienen (FRESCO-799).
- **Escenario.** Un invitado (30 altas por hora y por IP, `supabase/config.toml:215`) rellena su perfil con megabytes. Además `get_filtered_recipes` hace `unnest` de `ingredientes_odiados` por cada receta: un array enorme multiplica el coste del filtro.
- **Fix.** `CHECK` de cardinalidad y longitud (p. ej. 30 elementos de 60 caracteres, `nombre` 80, `planning_selection` 4 KB).

### C-11: el cron de reconciliación falla sin que nadie lo vea
- **Evidencia.** `cron.job_run_details` solo tiene `succeeded` (148 filas, la última 2026-10-12 04:17): `net.http_get` encola y devuelve éxito aunque la ruta responda 401/500. `net._http_response` guarda una sola fila (200). `app/api/cron/stripe-reconcile/route.ts` solo hace `console.error`/`console.warn`, sin Sentry ni alerta.
- **Escenario.** Una rotación de `CRON_SECRET` o un 500 sostenido deja la reconciliación (la única red tras C-03) parada semanas.
- **Fix.** Latido: el endpoint escribe en una tabla `job_heartbeat` y el monitor de GitHub alerta si pasan >26 h; capturar excepciones en Sentry.

### C-12: cobertura de tests
- **Evidencia.** `scripts/check-coverage.ts:101` (suelo cargado: 85,5 % funciones y 87,0 % líneas) frente a `:108` (suelo honesto 49,0 % de líneas, cuenta ficheros sin cargar como cero). Hay 248 ficheros de test para 400 ficheros de código. Las rutas más críticas (webhook, checkout, edge functions) tienen test, pero ninguno cubre el modo de fallo de C-03 ni el borrado de cuenta con suscripción (C-01).
- **Fix.** Subir el suelo honesto por tramos (p. ej. 55 % en un mes) y exigir test de regresión por cada hallazgo BLOCKER/ALTO cerrado.

### C-13: consentimiento Art. 9 solo en la interfaz
- **Evidencia.** `rg user_consents` en `lib/` y `app/` solo muestra escrituras (`lib/legal/consent-store.ts`, `app/api/consents/route.ts`); ninguna lectura ni política exige un consentimiento previo para guardar `alergenos`. En la BD: **2 de 4 perfiles con alérgenos no tienen ninguna fila en `user_consents`** (pueden ser datos de prueba anteriores a la función, pero demuestra que nada lo impide).
- **Fix.** Trigger o RPC que rechace escribir `alergenos`/`dieta_*` sin consentimiento vigente de la versión actual, o al menos un informe de perfiles sin consentimiento.

### C-14: encargados del tratamiento sin declarar
- **Evidencia.** `components/legal/legal-content-data.ts:164` lista Supabase, Stripe, PostHog, Sentry y Vercel. No aparecen **Resend** (correo de confirmación de suscripción, `lib/email/resend`), **Cloudflare Turnstile** (CSP `challenges.cloudflare.com`, login) ni **Google** (SMTP de Gmail para los correos de Auth, `lib/legal/entity.ts:2`). `rg -i "resend|turnstile|cloudflare|gmail"` en `components/legal` no devuelve la lista de encargados.
- **Fix.** Completar la lista y las transferencias internacionales; firmar o aceptar los DPA de cada uno.

### C-15: analítica de servidor al margen del consentimiento de cookies
- **Evidencia.** `lib/posthog/server.ts` y `supabase/functions/_shared/posthog.ts` envían eventos con `distinct_id` = id del usuario y `$set: { plan }` (`app/api/stripe/webhook/route.ts:188-195, 257-261, 308-315, 340-357`) sin consultar la decisión de `fresco_cookie_consent` (`lib/consent/cookie-consent.ts`), que solo gobierna el SDK del navegador.
- **Fix.** Guardar la decisión del usuario en BD y suprimir el envío de servidor para quien rechazó, o documentar la base jurídica (interés legítimo/ejecución del contrato) en la política y limitar las propiedades enviadas.

### C-16: todas las páginas son dinámicas por el nonce del CSP
- **Evidencia.** `proxy.ts:34-47` genera un nonce por petición y lo inyecta; el comentario lo reconoce ("every page is now dynamically rendered"). `curl -I https://fresco-pro.vercel.app/` devuelve `cache-control: private, no-cache, no-store` y `x-vercel-cache: MISS`. La landing y los textos legales no se pueden cachear en CDN y cada visita es una invocación de función.
- **Escenario.** Un pico de tráfico de lanzamiento consume el cupo de invocaciones de Hobby y sube el TTFB frente a una landing estática.
- **Fix.** Servir landing y `/legal/*` con CSP por hash (estáticas y cacheables) y reservar el nonce para `(app)`. Medir antes (LCP real, ya hay `lcp-budget.yml`).

### C-17: copias de seguridad
- **Evidencia.** `.github/workflows/db-backup.yml`: un `pg_dump` cifrado cada domingo 03:17 UTC, restaurado en un Postgres desechable y subido a R2 (última ejecución programada correcta el 2026-10-11; el 2026-10-04 falló y se tardó días en notarse, ver FRESCO-873). `db-restore-drill.yml` es solo `workflow_dispatch`. La frecuencia da un RPO de hasta 7 días y no hay PITR (Supabase Free).
- **Fix.** Al pasar a Supabase Pro, PITR; mientras tanto, backup diario y un simulacro programado (trimestral) con el tiempo medido en el ADR-0020.

### C-18: contraseñas filtradas
- **Evidencia.** `get_advisors(security)`: `auth_leaked_password_protection` activo como WARN. La comprobación del lado cliente (`lib/validation/pwned-password.ts`, CSP permite `api.pwnedpasswords.com`) se puede saltar llamando directamente a Supabase Auth.
- **Fix.** Activarlo al pasar a Pro (ya anotado como diferido); mientras tanto, el mínimo de 10 caracteres de `config.toml:194` es la única barrera.

### C-19: datos de supermercados con "riesgo aceptado"
- **Evidencia.** `supermarket_chain`: `mercadona` y `consum` con `permiso = 'riesgo-aceptado'` (ADR-0028, ADR-0037) y `habilitada = true`. Es una decisión de riesgo del fundador, no un permiso. Los enlaces/precios se muestran en la lista de la compra para usuarios con cuenta.
- **Fix.** Interruptor ya existente (`habilitada = false`) preparado como plan de contingencia y runbook de retirada en horas; dictamen legal antes del lanzamiento público.

### C-26: captcha sin verificar en el servidor y un secret con prefijo `NEXT_PUBLIC_`
- **Evidencia.**
  - Local: `[auth.captcha]` comentado en `supabase/config.toml:226`; `bun-test-setup.ts:78` vacía la site key en los tests.
  - Cliente: `vercel env ls` (solo nombres y scopes) muestra `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en `preview` y `production`, ninguna en `development`. El widget se vio activo en `/login` de `fresco-pre`.
  - Servidor: no verificado. El proyecto Supabase es uno solo para local, dev, staging y producción, así que el captcha de Auth es un único interruptor que no se ha podido leer desde fuera.
  - `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` existe en Vercel (`preview` y `production`). `rg "TURNSTILE_SECRET"` fuera de ficheros `.env*` no devuelve ningún uso en el código.
- **Escenario de fallo.** Si el interruptor de Supabase está apagado, el widget del cliente no protege nada: un script llama directo a `/auth/v1/signup` o `/auth/v1/token` sin token y salta el captcha (cuentas masivas, fuerza bruta de contraseñas, invitados desechables). Si algún día el código lee la variable `NEXT_PUBLIC_..._SECRET_KEY`, Next.js incrusta el secret en el bundle del navegador.
- **Fix.** Confirmar en el panel de Supabase (Authentication, Attack Protection) que el captcha está activo con el secret cargado allí; comprobar con una llamada directa sin `captcha_token` que se rechaza; borrar la variable `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` de Vercel y rotar el secret; documentar el estado por entorno en `docs/workflows/environments.md`. Ticket: FRESCO-907 (hijo de FRESCO-775, etiqueta `auditoria-7`).

## BAJO

- **C-20.** `/api/health` (`app/api/health/route.ts`) devuelve `{"commit":"f4a93ab","environment":"production"}` sin autenticar; `/qa` (`app/qa/page.tsx`) es pública en producción por diseño y documenta el contrato de las Edge Functions y los nombres de las variables `*_USER_EMAIL`. Ninguno expone secretos. Fix: quitar el SHA del health público (o limitarlo a un header con token del monitor) y proteger `/qa` con `noindex` y, en producción, redirigirla.
- **C-21.** `app/api/waitlist/route.ts` inserta como `anon` sin límite de ritmo ni captcha. La tabla ya acota longitud y duplicados (`supabase/migrations/20261011140000_waitlist_signups.sql`), pero un script puede llenarla de correos ajenos (y dar de alta a terceros sin su consentimiento). Fix: Turnstile (ya cargado en login) y un tope por IP.
- **C-22.** El trial sin tarjeta es una vez por cuenta (`lib/legal/pro-terms.ts`), pero crear cuentas nuevas con alias `+` sigue dando 7 días de Pro. El valor de Pro es estrecho (4 puertas `isPro` en `generate-meal-plan`), así que el coste real es bajo. Fix: pedir tarjeta al convertir y vigilar la tasa de altas por dominio de correo.
- **C-23.** `dependency-audit.yml` falló el 2026-10-12 15:47 (`bun audit`: `source-map-js` high, DoS de análisis de source maps vía `postcss`/`@tailwindcss/node`, y `katex` low; solo cadena de build/lint, no se ejecuta en producción). Dos PRs de Dependabot (major y minor) fallan el check el mismo día. Fix: subir `postcss` o fijar `overrides` de `source-map-js >= 1.2.2`, y repasar los PRs de Dependabot.
- **C-24.** Hoy (hasta las 16:00 UTC) hay 18 despliegues (4 a producción) y ayer 30 (7 a producción), según `gh api repos/BasiMontes/fresco/deployments`. Está por debajo del tope de 100 y la rama de FRESCO-906 reduce de 1,7 GB a 0,5 GB por despliegue, pero no se aplica la regla de "acumular en staging y promocionar por lotes" (nota del fundador de 2026-10-12): `push main` aparece 8 veces el 12 de octubre en `PR Check`.
- **C-25.** `recipes` es legible por `anon` con `USING (true)` (`pg_policies`, correcto para un catálogo público). El catálogo, que es el activo del producto, se puede copiar con una sola petición REST. Fix opcional: paginar `anon` o dejar el catálogo solo para `authenticated`.

## Lo que está bien (verificado, para no volver a abrirlo)

- **RLS.** 21 de 21 tablas de `public` con `relrowsecurity = true`; 6 tablas sin políticas a propósito (`rate_limit_*`, `rate_limits`, `stripe_webhook_events`, `supermarket_chain`, `supermarket_price_history`), cerradas con `REVOKE` a `anon`/`authenticated`. `anon` solo tiene `SELECT` en `recipes` e `ingredient_substitutions`. `authenticated` ya no tiene `INSERT` sobre `meal_plans`/`meal_plan_recipes`.
- **RPC.** `get_advisors` solo avisa de los 11 `SECURITY DEFINER` ejecutables por `authenticated`, y todos validan `auth.uid()` internamente (comprobado en `check_and_increment_rate_limit`, `get_catalog`, `get_filtered_recipes`); `reassign_guest_data` y las RPC de cron son solo `service_role`.
- **Edge Functions.** Autenticación en cada función, `requireServiceRoleCaller` con comparación en tiempo constante, re-autenticación reciente para borrar cuenta y reasignar datos, CORS por lista (sin `localhost` en alojado).
- **Stripe.** Firma verificada sobre el cuerpo crudo; idempotencia por `event.id`; `trial` con `missing_payment_method: 'cancel'`; guarda de suscripción cruzada para eventos fuera de orden; `checkout` rechaza invitados, Pro ya activo y aplica límite de ritmo; `portal` usa `request.nextUrl.origin` (no controlado por el cliente más allá del Host que Vercel normaliza).
- **Cabeceras en producción.** CSP con nonce y `strict-dynamic`, HSTS con `preload`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Capas.** `components/` y `app/` no importan Supabase (solo `lib/supabase/service` en las dos rutas de cron/webhook); `max-params: 2` es regla de lint (`eslint.config.js:229`); `cycles:check` forma parte de `repo:check`.
- **Operaciones.** Backup semanal restaurado antes de subir, `migration-drift-check` y `edge-functions-drift` en verde, monitor de uptime cada 5 minutos, `test-randomized` en verde 6 días seguidos, advisors de rendimiento solo con 3 avisos INFO.

## No medido

- Exploits no ejecutados (solo lectura). Los escenarios de C-01, C-03 y C-04 son de código: reproducirlos como pruebas rojas en el stack local antes de corregir.
- Secretos de Vercel/GitHub, configuración del panel de Stripe (correos de pago fallido, reintentos) y de Sentry (reglas de alerta).
- Tráfico y facturación real de Vercel; tamaño de bundle de `next build` (no se compiló).
- Contenido completo de las 538 recetas: los regex de C-02 son un mínimo; podría haber más lácteos o gluten escondidos en nombres que no usan las palabras clave.
- Rol admin real y cuenta Pro en vivo (sin cuentas de pago en la BD).

## Top 10 de prioridades

1. **C-01** Cancelar la suscripción de Stripe y borrar el cliente al eliminar la cuenta (BLOCKER).
2. **C-02** Corregir las etiquetas del catálogo (lácteos, halal, gluten) y añadir un test de datos que las valide (BLOCKER).
3. **C-04** Separar el proyecto Supabase de producción y descartar IDs de Stripe de otro modo antes de cobrar.
4. **C-03** Hacer el claim del webhook caducable y añadir un barrido de checkouts pagados sin Pro.
5. **C-05** Dejar `stripe-e2e` en verde, resolver la deriva del precio anual y convertirlo en puerta de promoción.
6. **C-07** Puerta de lanzamiento: Vercel Pro, Supabase Pro, alta de autónomo y dictamen legal con adjunto.
7. **C-06** Completar exportación y supresión de datos (favoritos, consentimientos, push, PostHog, Stripe).
8. **C-08** Cubrir mostaza y altramuces, y avisar en el onboarding de qué alérgenos protege la app.
9. **C-09 + C-10** Crear el plan semanal en una transacción con validación y poner límites de tamaño a `user_profiles`.
10. **C-11** Latido del cron de Stripe con alerta, para que la red de seguridad de pagos sea observable.

## Cómo se ha puntuado

Misma rúbrica v1 (media de siete ejes). Penalizan los BLOCKER porque una pérdida de dinero o un fallo de seguridad alimentaria hace que el eje no pueda pasar de 2,5-3; se premian los ejes donde los cierres de audit-6 se han comprobado de verdad (seguridad 4,0, arquitectura 4,3). Con C-01 y C-02 cerrados con test, y C-03/C-04/C-05 resueltos, la nota se iría a ~4,1.
