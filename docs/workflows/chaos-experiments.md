# Experimentos de caos

> **Idioma:** Español
> Cómo provocar un fallo controlado en la pila local, qué esperábamos que pasara y qué pasó de verdad (FRESCO-1248).

---

## La regla que no se negocia

**Los experimentos se hacen solo en la pila local de Supabase (Docker), nunca contra producción ni contra el proyecto alojado.** Local, staging y producción comparten un único proyecto Supabase (ADR-0020), así que un fallo provocado ahí sería un incidente real. El script `scripts/chaos/local.sh` se niega a funcionar si la URL de la API no es `127.0.0.1`.

Solo herramientas gratuitas: `docker pause`, `docker stop`, `docker restart` y `curl`.

---

## Cómo ejecutar uno

1. Arranca Docker y la pila como lo hace el CI: `supabase start -x realtime,storage-api,imgproxy,studio,inbucket,logflare,vector`.
2. Ejecuta el escenario: `scripts/chaos/local.sh <baseline|rest-pause|db-restart|edge-stop>`.
3. Lee la tabla que imprime: una fila por segundo con `<código HTTP>/<segundos>` de tres sondas. `000` es "no hubo respuesta antes del límite de la sonda".
4. Para la pila (`supabase stop`) cuando termines.

El script crea un usuario desechable, lo borra al salir y deshace el fallo al salir aunque se interrumpa. No hace `db reset`: los contenedores se paran y se reinician, los datos del volumen se conservan.

---

## Estado estable

Antes de romper nada, `baseline` mide lo que significa "todo va bien". El criterio de cada sonda:

| Sonda | Qué hace | Estado estable |
|---|---|---|
| `rest` | Lee una fila de `recipes` por PostgREST | 200, en milisegundos |
| `auth` | Inicia sesión con correo y contraseña en GoTrue | 200, en décimas de segundo |
| `function` | Llama a `get-shopping-list-suggestions` con una lista inexistente | 404 (la función llega a la base de datos y no encuentra la lista); cualquier otro código es el fallo |

---

## Escenarios disponibles

| Comando | Fallo que provoca | Hipótesis escrita antes de ejecutar |
|---|---|---|
| `rest-pause` | Congela PostgREST ~14 s | Las lecturas y la función fallan rápido y todo vuelve solo en 2 s o menos |
| `db-restart` | Reinicia el contenedor de la base de datos | PostgREST y las funciones se reconectan solas en menos de 15 s |
| `edge-stop` | Para el runtime de Edge Functions ~19 s | Las funciones fallan rápido con un 5xx y vuelven en menos de 5 s |
| `edge-pause` | Congela el runtime de Edge Functions ~18 s (`docker pause`) | La sonda de la función no recibe respuesta (`000`) mientras dure el corte, y la primera sonda tras reanudar ya responde `404` |

---

## Registro de experimentos

Cada fila es una ejecución fechada. Los resultados son de esa fecha y de esa máquina, no una promesa de rendimiento.

### 2026-11-22: primeros tres experimentos

| Escenario | ¿Se cumplió la hipótesis? | Qué pasó |
|---|---|---|
| `rest-pause` | A medias | Se recupera sola y de inmediato al reanudar. Pero **no falla rápido**: lectura y función se quedan sin respuesta hasta que el cliente se rinde. El login no se ve afectado |
| `db-restart` | Sí | Todo vuelve solo a la primera sonda tras el reinicio. Durante el corte, los códigos engañan: lectura `400`, login `500` y la función `401` |
| `edge-stop` | A medias | Vuelve solo a la primera sonda. Pero **no falla rápido**: la llamada a la función se queda sin respuesta (la pasarela no devuelve un 5xx) |

#### Hallazgos

1. **Las llamadas a Edge Functions del cliente no tienen límite de tiempo.** `callEdgeFunction` en `lib/api/edge-functions.ts` hace `fetch` sin `AbortSignal`, así que con un backend congelado la pantalla queda esperando lo que decida el navegador. Solo la baja de PostHog usa `AbortSignal.timeout`. Card: FRESCO-1249.
2. **Un fallo transitorio de Auth o de la base se convertía en un `401` y el cliente lo trata como sesión caducada.** En `supabase/functions/_shared/auth.ts`, cualquier `error` de `supabase.auth.getUser()` lanzaba `HttpError('No autorizado', 401)`, y `callEdgeFunction` redirige a `/login?session_expired=1` ante un 401, así que un corte de la base de datos de unos segundos podía cerrar la sesión de quien estuviera usando la app. Corregido en FRESCO-1250 (ver la repetición más abajo).

El estado de cada card vive en Jira, no aquí.

### 2026-11-22: `db-restart` repetido tras corregir FRESCO-1250

| Escenario | ¿Se cumplió la hipótesis? | Qué pasó |
|---|---|---|
| `db-restart` | Sí | Hipótesis: durante el corte la función ya no responde `401` sino `503`, y se recupera igual. Resultado: `503` durante el corte, `404` al volver la base. Lectura `400` y login `500` no cambian: son de PostgREST y GoTrue, no de nuestro código |

El helper es `sessionCheckFailure` en `supabase/functions/_shared/auth.ts`: solo un error de red de Auth o una respuesta 5xx cuenta como transitorio; cualquier otro, y cualquier error ambiguo, sigue siendo `401`. Lo usan `requireAuthenticatedUser`, `reassign-guest-data` y `delete-account`.

### 2026-11-24: la llamada a una función que no responde, tras FRESCO-1249

Las dos primeras filas se ejecutaron a mano en el navegador sobre la pila local: se pulsa "Generar mi menú" con el runtime de Edge Functions averiado y se mide cuánto tarda en salir un mensaje.

| Escenario | ¿Se cumplió la hipótesis? | Qué pasó |
|---|---|---|
| `docker stop` del runtime | Matiz sobre el hallazgo 1 | Hipótesis: la llamada se queda colgada. Resultado: la pasarela acaba respondiendo `502 Bad Gateway` a los ~25 s y la pantalla muestra el aviso genérico con la opción de reintentar. El `edge-stop` del script parecía no fallar nunca porque su sonda se rinde a los 8 s |
| `docker pause` del runtime | Sí | Hipótesis: con el límite de FRESCO-1249 la pantalla ya no espera sin fin. Resultado: la pasarela no responde, y a los 30 s sale "Está tardando más de lo normal. Puede que ya se haya generado: recarga la página." con el botón activo. Al `docker unpause` y reintentar, el menú se genera (0 planes antes, 1 después) y la pantalla pasa a `/calendar` |
| `edge-pause` (script) | Sí | Hipótesis: la sonda de la función no recibe respuesta mientras dure el corte y la primera tras reanudar ya responde `404`. Resultado: durante el corte las dos sondas de la función dieron `000/8.0` s (sin respuesta antes de su límite), `rest` y `auth` no se enteraron (`200`), y a la primera sonda tras `docker unpause` la función volvió a responder `404` en 0,04 s |

Lo que esta ejecución **no** cubre: el caso en que la generación termina en el servidor después de un corte **por tiempo** y el reintento recibe `409`. Aquí el primer intento, abortado por el cliente, no llegó a generar nada, así que ese camino lo cubren solo las pruebas unitarias de `generate-week-button` y de `use-generate-meal-plan`. Con un error de red sí se ejecutó, en E1 más abajo, y ahí la recuperación no existe (FRESCO-1283).

Para reproducir un servidor que no contesta usa `docker pause`, no `docker stop`: con un contenedor parado la pasarela acaba rindiéndose sola.

---

## Escrituras con la red cortada (FRESCO-1251, fase 1)

Hasta aquí los experimentos rompían el servidor. Estos rompen el camino entre el navegador y el servidor **a mitad de una escritura**, que es lo que pasa en una tienda sin cobertura o en un túnel. Se ejecutan a mano en el navegador, sobre la pila local y con una cuenta de prueba sembrada, con Playwright.

Hay dos formas de corte y no son lo mismo:

- **Sin conexión antes de enviar** (`context.setOffline(true)`): la petición no sale. El servidor no se entera.
- **Respuesta perdida**: la petición **llega y se ejecuta**, y la respuesta no vuelve (`route.fetch()` y después `route.abort('connectionreset')`). El navegador ve un error de red, igual que en el caso anterior, pero el servidor ya cambió. Es la clásica, y la que puede dejar la pantalla y la base de datos en estados distintos.

### Hipótesis (escritas antes de ejecutar, 2026-11-24)

Leídas del código, no medidas:

| # | Escritura | Corte | Hipótesis |
|---|---|---|---|
| E1 | Generar un menú (`GenerateWeekButton`) | Respuesta perdida | La pantalla dice "No pudimos generar tu menú. Intenta de nuevo." aunque el menú ya existe en la base de datos. Al reintentar, el servidor responde `409` y la pantalla dice "Ya existe un menú para esta semana. Elimínalo antes de generar uno nuevo.", en vez de enseñarlo. Es el mismo problema que FRESCO-1249 arregló para los cortes **por tiempo**, sin arreglar para un error de red, porque aquella recuperación solo se activa tras un `EdgeFunctionTimeoutError` |
| E2 | Marcar una franja como cocinada (`update-recipe-status`) | Respuesta perdida | La marca optimista se revierte y sale "No se pudo guardar el estado del plato. Vuelve a intentarlo.", pero la base de datos ya la tiene como cocinada. Al reintentar sale el `409` "Este plato ya fue marcado. Actualiza la página para ver su estado actual." Recuperable, pero la pantalla mintió un momento |
| E3 | Marcar un producto de la lista (`jsonb_set_comprado`) | Sin conexión antes de enviar | El producto se queda marcado, aparece el aviso de falta de conexión, y al volver la conexión se envía una sola vez; el servidor lo tiene como comprado y nada se duplica (cola de FRESCO-1014) |
| E4 | Marcar un producto de la lista (`jsonb_set_comprado`) | Respuesta perdida | La cola solo se usa si `navigator.onLine` es falso. Con la conexión "viva" el código entra en la rama de error del servidor: desmarca el producto y dice "No se pudo guardar el cambio. Vuelve a intentarlo.", pero la base de datos ya lo tiene comprado. Reintentar lo corrige y no duplica nada, porque la operación fija un valor explícito |

### Resultados (ejecutados el 2026-11-24)

Pila local, cuenta Free sembrada, navegador con Playwright. Las cuatro hipótesis se cumplieron; en E1, E2 y E4 lo que se cumplió es la debilidad que se sospechaba.

| # | ¿Se cumplió? | Qué pasó |
|---|---|---|
| E1 | Sí | La pantalla dijo "No pudimos generar tu menú. Intenta de nuevo." y la base de datos ya tenía el plan (0 antes, 1 después). Al reintentar, la pantalla dijo "Ya existe un menú para esta semana. Elimínalo antes de generar uno nuevo." Debilidad: FRESCO-1283 |
| E2 | Sí | Tras la respuesta perdida la pantalla volvió a ofrecer "Cocinado" y dijo "No se pudo guardar el estado del plato. Vuelve a intentarlo.", con la base de datos ya en `cocinada`. Al reintentar salió "Este plato ya fue marcado. Actualiza la página para ver su estado actual." y tras recargar salió "Cocinado". Debilidad menor: FRESCO-1284 |
| E3 | Sí | Sin conexión, el producto quedó marcado y salió el aviso "Sin conexión. Hemos dejado marcado el producto y lo guardaremos cuando vuelva la señal. Mantén esta pantalla abierta." La base de datos seguía en `false`. Al volver la señal el aviso desapareció y quedó `true`. Salieron exactamente dos peticiones: una fallida (`ERR_INTERNET_DISCONNECTED`, no llegó al servidor) y una `204` al reconectar |
| E4 | Sí | La pantalla desmarcó el producto y dijo "No se pudo guardar el cambio. Vuelve a intentarlo.", con la base de datos ya en `true`. Al volver a marcarlo quedó coherente y sin duplicados, porque `jsonb_set_comprado` fija un valor explícito. Debilidad menor: FRESCO-1284 |

**Lo que aguanta:** la cola sin conexión de la lista de la compra (E3) hace lo que promete: ni pierde la marca ni la envía dos veces.

**Debilidades nuevas, una card cada una:**

- **FRESCO-1283** (E1): FRESCO-1249 arregló el reintento tras un corte **por tiempo**, pero un error de red, que es la causa más habitual de perder una respuesta, sigue diciendo que el menú ya existe y que hay que eliminarlo. Es el menú que la persona quería.
- **FRESCO-1284** (E2 y E4): ante una respuesta perdida la pantalla revierte una marca que sí llegó. No pierde ni duplica datos y se corrige al reintentar o recargar, pero el mensaje "Vuelve a intentarlo" es falso.

Cómo se reproduce el corte de respuesta perdida: en una sesión de Playwright, `page.route('**/functions/v1/<función>', async route => { await route.fetch(); await route.abort('connectionreset'); })` (para una RPC de PostgREST, `'**/rest/v1/rpc/<nombre>'`), y `page.unroute(...)` para quitarlo. El estado de la base de datos se lee con `supabase db query --local`.

---

## Cómo añadir un experimento

1. Escribe la hipótesis **antes** de ejecutar: "si falla X, el usuario ve Y y se recupera en Z".
2. Añade el escenario a `scripts/chaos/local.sh` (un fallo, una forma de deshacerlo).
3. Ejecútalo y apunta una fila nueva en el registro con la fecha, lo que pasó y si la hipótesis se cumplió.
4. Por cada debilidad, abre una card o escribe un test de regresión; un hallazgo sin tarea se olvida.

Hipótesis pendientes de ejecutar: Stripe o su webhook sin responder. El corte de red a mitad de una escritura ya está en la sección de arriba.

---

**Ver También:**

- [environments.md](./environments.md): por qué los tres ambientes comparten un proyecto Supabase
- [e2e-flaky-triage.md](./e2e-flaky-triage.md): cómo se sigue un fallo intermitente en el CI
