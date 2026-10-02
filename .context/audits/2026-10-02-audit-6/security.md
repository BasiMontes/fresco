# Auditoría 6 — Eje Seguridad/RLS (2026-10-02)

Rúbrica v1. Repo `fresco-app` @ 3fe02a95 (staging). Evidencia viva: SELECT de solo lectura contra el proyecto hosted (`supabase db query --linked`: `pg_class`, `pg_policies`, `role_table_grants`, `pg_proc`, `pg_trigger`, `pg_constraint`, `cron.job`, `storage.*`) + `get_advisors(security)`. Sin escrituras. Los exploits se construyen por lectura de código/catálogo; no se ejecutó ninguno (read-only).

## Puntuación: **2,5 / 5** (audit-5: 3/5)

| Severidad | Nº |
|---|---|
| BLOCKER | 1 |
| ALTO | 2 |
| MEDIO | 4 |
| BAJO | 7 |

Motivo de la bajada: el fix del BLOCKER de audit-5 (A5-B2, `meal_plan_recipes`) **no cierra el agujero**: la RPC que introdujo el propio fix lo reabre. Mismo patrón que A4-B1/A5-B2 por tercera vez ("el fix protege el camino que el auditor probó, no el camino equivalente").

---

## Hallazgos

### A6-S1 — BLOCKER — `apply_recipe_status_update` reabre A5-B2 por completo (SECURITY INVOKER + GUC de confianza que fija el propio llamante)

**Evidencia (viva, `pg_proc` + migración 20260928170000):**
- `public.apply_recipe_status_update(p_slot_id, p_estado, p_rating, p_recipe_id)`: `prosecdef=false`, `EXECUTE` concedido a `authenticated` (y `anon`/PUBLIC por defecto).
- Su cuerpo hace `set_config('app.mpr_trusted_write','on',true)` **y luego** el `UPDATE meal_plan_recipes SET estado/rating/recipe_id = coalesce(...)`. Sin comprobación alguna: ni estado terminal, ni whitelist de `estado`, ni re-filtro de alérgenos/dieta, ni duplicado en semana, ni rate limit.
- El trigger `protect_meal_plan_recipes_integrity` deja pasar cualquier UPDATE si `current_setting('app.mpr_trusted_write')='on'`. El GUC lo pone la propia función que el atacante controla.
- Toda la validación (terminal-state guard, `get_filtered_recipes`, dupe check, `assertEstadoValido`, rate-limit 60/h) vive en la Edge Function `update-recipe-status`, que el atacante simplemente no llama.

**Exploit (cualquier sesión autenticada, incluida invitada con `signInAnonymously()`):**
1. Obtener JWT (anonymous sign-in, 30/h/IP, sin captcha).
2. Leer sus slots: `GET /rest/v1/meal_plan_recipes?select=id` (RLS permite los propios; tras `generate-meal-plan`, o tras INSERT directo, ver A6-S4).
3. `POST /rest/v1/rpc/apply_recipe_status_update {"p_slot_id":"<id>","p_estado":"cocinada","p_rating":1}` -> `update_recipe_learning` (SECURITY DEFINER) hace `recipes.veces_cocinada+1`, `veces_calificada+1`, recalcula `rating_promedio` del catálogo **global**.
4. Repetir `pendiente` -> `cocinada` -> `pendiente` -> `cocinada` en bucle (no hay guard terminal ni rate limit en la RPC) = inflar/hundir `veces_cocinada`, `veces_descartada`, `rating_promedio`, `ultima_vez_en_menu` de cualquier receta que el atacante pueda colocar en un slot propio (`p_recipe_id` acepta cualquiera). Envenena el scoring de generación para todos los usuarios (exactamente el impacto declarado en A5-B2).
5. Además `p_recipe_id`: un slot propio puede apuntar a una receta con alérgeno declarado o `activo=false`, saltándose la defensa de alérgenos en profundidad (impacto sobre uno mismo, pero anula la "red" ADR-0001).

**Fix:** (a) la RPC debe ser `SECURITY DEFINER` con `auth.uid()` + ownership del slot, reproducir las reglas (whitelist de estado `cocinada|descartada|sustituida`, no-terminal, rating 1..5, `get_filtered_recipes` para sustitución, dupe), rate limit propio y `REVOKE EXECUTE ... FROM public, anon`; o (b) mover esas reglas a un trigger/constraint que no dependa de un GUC controlable. Nunca un GUC "de confianza" seteable desde una función invocable por el cliente: el GUC solo es seguro si lo fija una función DEFINER que ya validó. Añadir test e2e que llame `/rpc/apply_recipe_status_update` directamente con estado `pendiente`/recipe alergénica y exija 4xx.

---

### A6-S2 — ALTO — SSRF ciego + tarpit en `send-weekly-reengagement-push` vía `push_subscriptions.endpoint` sin validar

**Evidencia:** `push_subscriptions_insert_own` solo comprueba `auth.uid()=user_id`; `authenticated` tiene `INSERT`; `pg_constraint` solo tiene `UNIQUE(endpoint)` (sin CHECK de esquema/host/longitud). La Edge Function (cron semanal, service role) hace `webpush.sendNotification({endpoint: sub.endpoint, ...})` secuencial para cada fila de usuarios sin plan esa semana, sin allowlist de hosts de push services ni timeout explícito.

**Exploit:** invitado anónimo inserta N filas con `endpoint='https://attacker.tld/x'` (o `http://` interno) y claves p256dh/auth válidas. Domingo 18:00 el cron hace POST firmado (cabecera VAPID, JWT con `aud`=origen del atacante) desde la infraestructura de Supabase a esa URL: SSRF ciego, y si el servidor del atacante responde lento/cuelga, el bucle secuencial no termina antes del límite de tiempo y **ningún usuario legítimo recibe el push** (DoS del loop de re-engagement). Los invitados sin plan caen siempre en `get_push_subscriptions_without_current_plan`.

**Fix:** CHECK/trigger en `endpoint` (`https://` y host en allowlist: `fcm.googleapis.com`, `*.push.apple.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`), límite de filas por usuario, no aceptar suscripciones de `is_anonymous`, `timeout` en `webpush` y envío con concurrencia acotada.

---

### A6-S3 — ALTO — `/api/stripe/checkout`: trials de 7 días ilimitados sin tarjeta (granja de trials)

**Evidencia:** `app/api/stripe/checkout/route.ts` crea sesión `mode:'subscription'`, `trial_period_days:7`, `payment_method_collection:'if_required'`, sin `customer`, sin comprobar `profile.plan`/suscripción previa, sin excluir `is_anonymous`, sin rate limit. El webhook `checkout.session.completed` no valida estado de la sesión ni trial previo y sobrescribe `stripe_subscription_id`/`plan:'pro'`.

**Exploit:** (1) una misma cuenta repite el checkout cada 7 días (Stripe crea un customer y una suscripción nuevos cada vez; el trial vuelve a empezar) = Pro gratis perpetuo; (2) o N invitados anónimos (30/h/IP) pagan trial sin tarjeta. Mismo agujero económico que A4-B1 por otra puerta. (Nota: el fundador confirmó que hoy no hay cobros reales; la urgencia es pre-lanzamiento.)

**Fix:** reutilizar/crear un único `customer` por usuario (guardar `stripe_customer_id` antes), rechazar checkout si ya existe `stripe_subscription_id` (o trial consumido), exigir cuenta no anónima, `payment_method_collection:'always'` o una marca `trial_consumed`, y rate limit.

---

### A6-S4 — MEDIO — Rutas INSERT de `meal_plans`/`meal_plan_recipes` siguen abiertas (A5 las dejó "como seguimiento")

**Evidencia:** `mpr_insert_own` (WITH CHECK solo ownership del plan), `GRANT INSERT` a `authenticated`, trigger de protección solo `BEFORE UPDATE`; `meal_plans_insert_own` análogo, UPDATE de tabla completa.

**Exploit:** cliente inserta slots con `estado='cocinada'`, `rating`, `recipe_id` arbitrario (incluso con alérgeno), `sustitucion_ingrediente` forjado (que `generate-shopping-list` consume tal cual, saltándose el allergen re-check de `confirm_ingredient_substitution`). También crea planes de cualquier semana sin pasar por `generate-meal-plan` (rate limit 5/h, entitlement Pro, `get_filtered_recipes`). Es el punto de partida del exploit A6-S1 sin necesitar generar nada. Impacto cruzado limitado a uno mismo salvo combinado con S1.

**Fix:** revocar `INSERT` en `meal_plan_recipes`/`meal_plans` a `authenticated` y que solo `generate-meal-plan`/RPCs DEFINER escriban; o trigger BEFORE INSERT que fuerce `estado='pendiente'`, `rating null`, `sustitucion null`.

---

### A6-S5 — MEDIO — `shopping_lists` INSERT/UPDATE sin comprobar propiedad de `meal_plan_id` (referencia cruzada entre tenants)

**Evidencia:** `shopping_insert_own` WITH CHECK `auth.uid()=user_id` únicamente; `shopping_update_own` idem; `unique_plan_lista(meal_plan_id)`; `GRANT UPDATE/INSERT` tabla completa.

**Exploit:** si el atacante conoce un `meal_plans.id` ajeno (UUID, no enumerable pero filtrable p. ej. en logs/capturas), inserta `shopping_lists(meal_plan_id=<victima>, user_id=<yo>)`: ocupa el slot único, la víctima recibe 409/500 al generar su lista, y el error FK/unique es un oráculo de existencia. Bajo por unguessability, pero rompe el patrón "ownership en cada FK".

**Fix:** WITH CHECK `exists(select 1 from meal_plans where id=meal_plan_id and user_id=auth.uid())` en INSERT/UPDATE.

---

### A6-S6 — MEDIO (latente) — Tablas de supermercado legibles directamente por `authenticated` (incluye invitados), sin pasar por la compuerta legal del RPC

**Evidencia:** 7 tablas con `SELECT ... USING (true)` para `authenticated`; hoy `supermarket_chain`=4 filas, `product/price/match`=0. El comentario de la migración afirma que la compuerta de permiso se aplica "en el cuerpo de la función", pero un `SELECT` directo a `supermarket_price`/`supermarket_price_history`/`supermarket_product` no la aplica: cadenas con `permiso` `pendiente`/`rechazado`/`habilitada=false` serán legibles en cuanto se carguen datos. `supermarket_chain` expone además `permiso`/`permiso_ref` (postura legal interna) a cualquier invitado.

**Fix:** RLS de `price`/`product`/`history`/`match` con `exists` sobre `supermarket_chain` habilitada+permiso; `supermarket_chain` solo columnas públicas (vista) o sin SELECT directo; `history` solo `service_role`. `get_supermarket_demand` (migración 20261001190000) está bien: DEFINER, `search_path` fijado, EXECUTE solo `service_role` (verificado en vivo), agrega sin identificadores de usuario.

---

### A6-S7 — MEDIO — Sin cuotas ni topes de tamaño en tablas escritas por el cliente + identidad desechable (anonymous sign-in sin captcha)

**Evidencia:** `recetas_propias` (texto/JSON sin límite), `shopping_lists.items`, `meal_plans.advertencias`, `push_subscriptions`, `favorites`, y `check_and_increment_rate_limit` (EXECUTE `authenticated`) acepta `p_endpoint` libre y `p_limit` del llamante: genera filas arbitrarias en `rate_limits` (limpiadas a 2-3 h, pero ilimitadas en la hora). `enable_anonymous_sign_ins=true`, sin `[auth.captcha]` (local; hosted no verificable por lectura). Los rate limits por usuario se evaden rotando invitados (30/h/IP).

**Fix:** CHECK de longitud/`jsonb` por tamaño, cuota de filas por usuario (trigger), `p_endpoint` validado contra lista en la RPC (o hacer la RPC no invocable por el cliente: wrapper DEFINER por endpoint), activar captcha de Supabase para anonymous/sign-up.

---

### BAJOS

- **A6-S8** — Comparación no constante en `requireServiceRoleCaller` (`apikey !== expected`) y en `stripe-reconcile` (`authorization !== Bearer ...`). Residual de A5-H6. Usar comparación en tiempo constante.
- **A6-S9** — `TRUNCATE`, `TRIGGER`, `REFERENCES` concedidos a `anon` y `authenticated` en todas las tablas `public` (default privileges); RLS no aplica a TRUNCATE. No explotable vía PostgREST, sí vía cualquier conexión directa con esos roles. Además las funciones trigger DEFINER `prevent_client_subscription_writes` y `protect_meal_plan_recipes_integrity` son ejecutables por `anon`/`authenticated` (advisor WARN 0028/0029). `REVOKE` de privilegios sobrantes y de EXECUTE en funciones trigger.
- **A6-S10** — Webhook Stripe: firma correcta (`constructEvent`, raw body, secret por entorno), pero `checkout.session.completed` no comprueba `session.payment_status`/estado de la suscripción ni orden: un replay/retraso tras `subscription.deleted` re-concede `plan:'pro'` hasta el cron diario (el `plan_expires_at` se rellena con el `trial_end` pasado; el gate de la Edge Function sí lo trata como caducado, el gate de UI no). Sin tabla de idempotencia por `event.id` (solo comparación de `stripe_subscription_id`); errores post-firma se tragan con 200 (confía en el reconcile). Aceptable, documentar.
- **A6-S11** — Leaked-password protection sigue desactivada en hosted (advisor `auth_leaked_password_protection`); mitigado en cliente con HIBP range API y `minimum_password_length=10`. Deuda conocida (A4-H8), requiere plan Pro de Supabase.
- **A6-S12** — `.env.ci` (rastreado, necesario para CI) y `scripts/seed-e2e-users.ts` contienen cadenas con forma de clave Stripe test, `whsec_` y JWT (`eyJ…`). No pude decodificarlas (acción bloqueada por el clasificador de credenciales) y no las he impreso. Si son demos locales/dummies (lo esperable tras FRESCO-376) es correcto; si alguna es real, rotarla. `whsec_[A-Za-z0-9]{20}` aparece en 2 commits del historial (289a39ef, 1c2548bb, ambos `.env.ci`). Sin patrones `sk_live_`, `sb_secret_`, `AIza`, `ghp_`, claves privadas ni tokens Atlassian en árbol ni historial.
- **A6-S13** — `reassign-guest-data` acepta cualquier access token válido de la cuenta destino sin exigir recencia (`iat`), a diferencia de `delete-account` (5 min). Un token antiguo filtrado basta para volcar datos de invitado en esa cuenta. Aplicar `isTokenRecent`.
- **A6-S14** — Higiene: `get_catalog.p_limit` sin tope superior; funciones DEFINER con `search_path=public` sin `pg_temp` explícito al final (todas califican `public.`, riesgo bajo); `JsonLd` no escapa `<` (datos 100 % estáticos hoy).

---

## Revisión tabla a tabla (RLS vivo)

RLS habilitado en las 18 tablas `public`; 0 vistas; `supabase_realtime` sin tablas publicadas; bucket `recipe-photos` público con escritura solo `service_role`.

| Tabla | Policies | GRANT authenticated | Veredicto |
|---|---|---|---|
| user_profiles | S/I/U own (UPDATE sin WITH CHECK explícito = USING) | I,S,U (tabla completa) | OK: trigger BEFORE INSERT OR UPDATE protege plan/stripe/payment_failed_at (regresión A4-B1 OK) |
| meal_plans | S/I/U/D own | I,S,U,D | Sin protección de columnas ni cuota (S4) |
| meal_plan_recipes | S/I(owner vía plan)/U(owner) | I,S,U | UPDATE "protegido" pero bypass S1; INSERT abierto S4 |
| shopping_lists | S/I/U/D own | I,S,U,D | S5 |
| recetas_propias | S/I/U/D own | I,S,U,D | OK salvo S7 |
| favorites | S/I/D own | I,S,D | OK |
| push_subscriptions | S/I/D own | I,S,D | S2 |
| recipes | SELECT anon+auth | S | OK (sin escritura) |
| ingredient_substitutions | SELECT anon+auth | S | OK |
| rate_limits / rate_limit_exempt_users | sin policy | ninguno | OK (0 exentos, A4-H9 sigue cerrado) |
| supermarket_* (6) + ingredient_product_match | SELECT auth `true` | S | S6 |

## Funciones SECURITY DEFINER (vivo)

Todas con `search_path` fijado. Con identidad `p_user_id`: `get_filtered_recipes`, `get_catalog`, `get_recent_recipe_marks`, `get_user_cooked_recipe_ids`, `get_user_recipe_engagement`, `check_and_increment_rate_limit` verifican `= auth.uid()` (las tres últimas con `and mp.user_id = auth.uid()`; `NULL` falla cerrado). `reassign_guest_data` y `get_push_subscriptions_without_current_plan`, `get_supermarket_demand`: solo `service_role`. `swap_meal_plan_slots`/`copy_meal_plan_to_week`: ownership por slot y mensajes unificados (A5-H6 mensajes corregido). `jsonb_*`: DEFINER con `user_id=auth.uid()`. **Mal:** `apply_recipe_status_update` (S1).

## Edge Functions

Todas `verify_jwt=true` salvo `send-weekly-reengagement-push` (false, `requireServiceRoleCaller`, esperado). CORS por allowlist, localhost solo en stack local (A4-L2 OK). `update-recipe-status`: bien validada pero esquivable (S1). `delete-account`: re-auth reciente + rate limit. `delete-catalog-recipe`: allowlist `ADMIN_USER_ID` + service role acotado. `generate-shopping-list` y `get-shopping-list-suggestions`: sin rate limit (BAJO, coste de CPU propio). No hay fetch de URLs controladas por usuario excepto S2.

## Regresiones (audit-4/5)

| Hallazgo | Estado |
|---|---|
| A5-B2 meal_plan_recipes GRANT UPDATE | **REGRESIÓN / fix ineficaz** (A6-S1) |
| A4-B1 INSERT user_profiles plan | Cerrado, verificado en vivo |
| A4-B2 filtro alérgenos (lower, vocab CHECK) | Cerrado (`recipes_alergenos_vocab`, lower en ambos lados) |
| A4-H1/H2/L7 | Edge OK; esquivables por S1 |
| A4-H8 password | min 10 OK; leaked-pw hosted sigue off (S11) |
| A4-H9 exentos de rate limit | Cerrado (0 filas) |
| A4-L1 open redirect | Cerrado (backslash + comprobación de origen; `/\t/evil` también cae) |
| A4-L2 CORS localhost | Cerrado |
| A4-L3 CSV injection | Cerrado (`'` prefix) |
| A4-L4 oráculo de contraseñas | Cerrado (token, rate limit); ver S13 |
| A4-L5 `/qa` | Cerrado (placeholder + noindex) |
| A4-L6 `.or()` | Cerrado (escapado) |
| A4-L11 delete-account | Cerrado |
| A4-M10 CSP | **Cerrado y mejorado**: enforcing con nonce + strict-dynamic en `proxy.ts` |
| A5-H6 mensajes swap/copy | Cerrado; comparación no constante persiste (S8) |
| A5-H8 `/admin/recipes` sin gate | Cerrado (`isAdminUser` + `notFound()`); cookie de sesión no httpOnly es el diseño de `@supabase/ssr` |

## Positivos

- RLS en 100 % de tablas, sin vistas ni realtime expuesto, sin `auth.role()`/`user_metadata` en políticas; ownership con `(select auth.uid())`.
- Patrón DEFINER disciplinado: `search_path` fijado, `EXECUTE` revocado en las RPC de servicio (verificado en `pg_proc`).
- Trigger de `user_profiles` correcto en INSERT y UPDATE; `session_user` allowlist.
- CSP enforcing con nonce; HSTS preload, XFO DENY, nosniff, Referrer/Permissions-Policy.
- Stripe: verificación de firma sobre cuerpo crudo, secret por entorno, guard de precio esperado, guard de suscripción desfasada, cron de reconciliación con barrido de huérfanos.
- Sin secretos de producción en árbol ni historial según patrones; `.env*` ignorado.
- Fetchers de scripts (supermercado, fotos, Jira) usan hosts fijos; sin SSRF de entrada de usuario salvo S2. Enlaces de supermercado provienen de catálogos versionados.
- Función de exportación CSV, `safeNextPath`, `delete-account` (reauth) y `reassign-guest-data` (rate limit + token) bien endurecidas.

## Nota de método

Los exploits de S1/S2/S3 se derivan de definiciones vivas (`pg_get_functiondef`, `pg_policies`, `pg_constraint`, grants) y del código; no se ejecutaron por la regla de solo lectura. Recomendado: reproducirlos en el stack local de CI como tests rojos antes de corregir.
