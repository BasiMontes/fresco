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

## Estado estable de los flujos completos (FRESCO-1251, fase 2)

Las tres sondas de arriba miden la infraestructura. Un usuario no usa sondas: usa **flujos**. El escenario `flows` ejecuta de verdad los cuatro que importan, con una cuenta desechable, y comprueba el resultado **leyéndolo del destino**, no por el código de respuesta: un `200` dice que la petición estaba bien formada, no que ocurriera lo que se esperaba.

Son flujos **a nivel de API** contra la pila local. El tiempo que tarda la interfaz en pintar no entra, y la pantalla de acceso solo entra por su parte de servidor (la concesión por contraseña).

### Expectativa (escrita antes de medir, 2026-11-24)

| Flujo | Qué hace | Qué espero que sea "todo va bien" |
|---|---|---|
| `login` | Concesión por contraseña de Auth, lo que hace el formulario de acceso | `200` con un token de acceso, en menos de 1 s |
| `generar-menu` | Llama a `generate-meal-plan` (el perfil se guarda antes, como hace el onboarding, y no se mide) | `200` con un `meal_plan_id` y 21 franjas en la base de datos, en menos de 5 s (ADR-0005: la selección es determinista y se observó ~2-3 s) |
| `abrir-lista` | `generate-shopping-list` y la lectura que hace la página | `200` y una lista con al menos un producto leída de la base de datos, en menos de 3 s |
| `marcar-producto` | `jsonb_set_comprado` sobre el primer producto | `204` y, al leerlo de vuelta, `comprado = true`, en menos de 1 s |

### Criterio medible y medición (2026-11-24)

`scripts/chaos/local.sh flows`: una cuenta desechable, los cuatro flujos en orden y una línea por flujo con `OK`, `SLOW` (resultado correcto pero fuera de tiempo) o `FAIL` (resultado incorrecto). Sale con `0` si todo va bien y con `1` si algún flujo no. Medido tres veces seguidas en la pila local, en caliente:

| Flujo | Criterio de "todo va bien" | Medido |
|---|---|---|
| `login` | `200` con un token de acceso, en 1 s o menos | 0,118 a 0,124 s |
| `generar-menu` | `200`, un `meal_plan_id` y 21 franjas en la base de datos, en 3 s o menos | 0,064 a 0,072 s (0,25 s la primera vez, en frío) |
| `abrir-lista` | `generate-shopping-list` `200` y la lectura de la página `200` con al menos un producto, en 2 s o menos entre las dos | 0,044 a 0,050 s, con 39 a 43 productos |
| `marcar-producto` | `204` y, al leerlo de vuelta, `comprado = true`, en 1 s o menos | 0,004 a 0,005 s |

**Mi expectativa estaba equivocada por un orden de magnitud.** Esperaba 5 s para generar el menú y salen unos 0,07 s: los 2-3 s que cita la ADR-0005 eran el recorrido completo en el navegador, no la función.

**Los límites son holgados a propósito.** Entre 8 y 200 veces lo medido. Sirven para separar "todo va bien" de "algo falla", no son un presupuesto de rendimiento: un fallo de verdad, como un servidor que no contesta, aparece como `FAIL` con código `000` a los 15 s, que es el tiempo máximo de cada llamada del script. Si se quisiera vigilar la velocidad, habría que medir mucho más (en el CI, con máquinas más lentas y ruidosas) antes de apretarlos.

**Control negativo.** Con el runtime de Edge Functions congelado (`docker pause`), `login` sigue `OK` y `generar-menu` sale `FAIL` (`http 000`, 0 franjas en la base de datos, 15,0 s), el resto de flujos no se ejecutan y el script sale con `1`. Descongelado, vuelve a salir con `0`. El script borra su usuario al salir en los dos casos.

---

## Escenarios disponibles

| Comando | Fallo que provoca | Hipótesis escrita antes de ejecutar |
|---|---|---|
| `rest-pause` | Congela PostgREST ~14 s | Las lecturas y la función fallan rápido y todo vuelve solo en 2 s o menos |
| `db-restart` | Reinicia el contenedor de la base de datos | PostgREST y las funciones se reconectan solas en menos de 15 s |
| `edge-stop` | Para el runtime de Edge Functions ~19 s | Las funciones fallan rápido con un 5xx y vuelven en menos de 5 s |
| `flows` | Ninguno: mide los cuatro flujos completos | Los cuatro terminan bien y dentro de su criterio (véase arriba) |
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

## Stripe sin responder (FRESCO-1251, fase 3)

Dos preguntas distintas, porque Stripe habla con nosotros en dos direcciones:

- **Nosotros llamamos a Stripe** (`/api/stripe/checkout` crea la sesión de pago) y Stripe no contesta. La pregunta es qué ve quien paga.
- **Stripe nos llama a nosotros** (`/api/stripe/webhook`) y no llega, o llega mientras algo falla. La pregunta es si el estado de la suscripción queda coherente al volver.

### S1: la llamada a Stripe no contesta (hipótesis escritas antes de ejecutar, 2026-11-24)

Leídas del código, no medidas. Hechos de partida: el cliente de Stripe se crea solo con `apiVersion` (`lib/stripe.ts`), sin `timeout` ni `maxNetworkRetries` propios; el SDK instalado (23.2.0) trae un `timeout` por defecto de 80 s; la ruta hace varias llamadas a Stripe en serie; y antes de la primera solo lee (el perfil y el registro de consentimientos), no escribe.

| # | Hipótesis |
|---|---|
| S1a | Con la configuración real, una llamada a Stripe que no contesta tarda **más de 80 s** en rendirse, más con los reintentos por defecto del SDK. Es mucho más de lo que espera quien paga |
| S1b | Mientras tanto la pantalla se queda en estado "pendiente" sin ningún límite en el cliente: `fetch('/api/stripe/checkout')` en `use-pro-checkout.ts` no lleva `AbortSignal` |
| S1c | Cuando Stripe por fin falla, la ruta contesta `500` "No se pudo iniciar el pago." y la pantalla dice "No se pudo iniciar el pago. Inténtalo de nuevo.". No cambia el plan ni deja una suscripción a medias, porque antes de Stripe no escribió nada |
| S1d | Reintentar dentro de la ventana de idempotencia no crea una segunda sesión de pago |

### Resultados de S1 (2026-11-24)

`bun run chaos:stripe-stall` construye un cliente de Stripe con **las mismas opciones que la aplicación** (solo `apiVersion`) y lo apunta a un socket local que acepta la conexión y no escribe nada, que es el Stripe mudo. Hace una llamada y mide.

| # | ¿Se cumplió? | Qué pasó |
|---|---|---|
| S1a | Sí, y más de lo que decía | La llamada tardó **241,0 s** en rendirse: `StripeConnectionError: Request aborted due to timeout being reached (80000ms)`. Abrió 3 conexiones, una más los 2 reintentos que el SDK trae por defecto en Node, de 80 s cada una. Son cuatro minutos esperando en una llamada, y la ruta hace varias en serie. Debilidad: FRESCO-1285 |
| S1b | Sí (leído en el código, no ejecutado) | `use-pro-checkout.ts` hace `fetch('/api/stripe/checkout')` sin `AbortSignal` y deja `isRedirecting` en `true` hasta que vuelve. Quien paga ve el botón en espera sin ninguna salida propia. Mismo hallazgo: FRESCO-1285 |
| S1c | Sí (leído en el código y en `route.test.ts`, no ejecutado) | Cuando Stripe por fin falla, la ruta contesta `500` "No se pudo iniciar el pago." y la pantalla dice "No se pudo iniciar el pago. Inténtalo de nuevo.". Antes de llamar a Stripe la ruta solo lee, así que el plan no cambia y no queda nada a medias |
| S1d | Matiz | La ventana de idempotencia es de **un minuto** (`BUCKET_SECONDS = 60` en `checkout-guard.ts`). Tras una espera de cuatro minutos un reintento ya usa otra clave, así que la coherencia no la da la idempotencia sino `expireOtherOpenCheckoutSessions`, que deja una sola sesión de pago abierta. Leído en el código, no ejecutado |

**Lo que no se midió:** qué corta primero, el SDK o el límite de duración de la función en Vercel. Esta medición es del SDK, solo; el límite de la plataforma depende del plan y no se ha comprobado.

**Lo que no se ejecutó:** el recorrido completo desde la pantalla. Exigiría que la aplicación hablara con un Stripe que no contesta. El cliente se construye en `lib/stripe.ts` sin ninguna opción de entorno para el host y la pila local no trae un Stripe de mentira, así que no se puede redirigir. Véase S2.

### S2: el webhook no llega, o llega con la base de datos caída

**No se puede ejecutar de punta a punta en la pila local.** El tratamiento de `checkout.session.completed` llama a `stripe.subscriptions.retrieve` (`lib/billing/grant-pro.ts`), y la pila local solo tiene credenciales de Stripe de relleno (`.env.ci`), así que el webhook no llegaría a conceder Pro aunque llegara la firma bien formada.

Lo que sí hay, y es mucho:

- `app/api/stripe/webhook/route.test.ts` fija, con simulaciones: una caída de Stripe al consultar el cargo contesta `500` y devuelve la reclamación para que Stripe reintente; si no se puede registrar la reclamación contesta `500` y no procesa nada; un fallo no transitorio (un error, una restricción) se queda en un `200` registrado porque reintentar repetiría el error; una entrega ya procesada no vuelve a disparar el evento de embudo; y la toma de una reclamación caducada se avisa a Sentry.
- Los escenarios `@requiere-stripe-real` corren cada semana contra `staging` con el modo de pruebas de Stripe (`stripe-e2e.yml`).

Lo que **no** hay, y esto es el hueco: ninguna ejecución con la base de datos realmente caída mientras llega un webhook real. Para cerrarlo hace falta un Stripe falso que pueda contestar a `subscriptions.retrieve` y a `checkout.sessions.create` y, cuando se quiera, no contestar. Es la card FRESCO-1286.

---

## Decisión sobre el CI (FRESCO-1251, 2026-11-24)

**Ningún experimento entra en el CI. Se ejecutan a mano justo antes de cada pasada de auditoría.** Decisión del dueño.

Por qué:

- **El presupuesto del job `test:e2e` es estrecho** y se vigila con `bun run ci:e2e-wallclock` (ADR-0018). Un paso más dentro de ese job lo gasta, y el margen se lee con ese comando, no aquí.
- **Los flujos ya se ejercitan en cada PR.** Iniciar sesión, generar un menú, abrir la lista y marcar un producto son escenarios `@automatizado` del e2e. `flows` sin un fallo inyectado casi no añade señal; su valor está en compararlo con lo que sale cuando se rompe algo.
- **Los experimentos con fallo no son de aprobado o suspenso.** Cuestan entre 30 y 60 s cada uno y su salida es una tabla que lee una persona y compara con una hipótesis.

Un workflow semanal aparte que arrancara su propia pila (la opción que se descartó) seguiría siendo posible; no se descartó por imposible, sino porque la señal que daría ya la dan el e2e y la lectura manual.

### Qué se ejecuta antes de cada pasada de auditoría

Lo ejecuta la sesión de trabajo justo antes de la auditoría, con la pila local arrancada (véase "Cómo ejecutar uno"). El auditor trabaja en solo lectura: no arranca la pila, solo lee la fila fechada del registro y la da por buena si es de esa misma semana (decisión del dueño del 2026-11-24, auditoría 11).

1. `scripts/chaos/local.sh flows` debe salir con `0`, con los cuatro flujos en `OK`. Si uno sale `SLOW` o `FAIL`, es un hallazgo.
2. `edge-pause`, `rest-pause`, `db-restart` y `edge-stop`: se leen las tablas y se comparan con la fila del registro de la última vez. Un comportamiento distinto es un hallazgo.
3. `bun run chaos:stripe-stall`, con la configuración real: debe rendirse dentro del límite que acuerde FRESCO-1285, no en 241 s.
4. Se apunta una fila nueva en el registro con la fecha, y una card por cada debilidad nueva.

### Cuándo reabrir esta decisión

- Si `flows` falla en una pasada, porque entonces un paso automático habría avisado antes.
- Cuando FRESCO-1286 (un Stripe falso) permita ejecutar el pago y el webhook de punta a punta: habrá más experimentos y puede compensar automatizar alguno.

---

## Cómo añadir un experimento

1. Escribe la hipótesis **antes** de ejecutar: "si falla X, el usuario ve Y y se recupera en Z".
2. Añade el escenario a `scripts/chaos/local.sh` (un fallo, una forma de deshacerlo).
3. Ejecútalo y apunta una fila nueva en el registro con la fecha, lo que pasó y si la hipótesis se cumplió.
4. Por cada debilidad, abre una card o escribe un test de regresión; un hallazgo sin tarea se olvida. Si el usuario la ve (un mensaje falso, una marca que se revierte, una pantalla que no cuadra con la base de datos), la card es un `Error`, no una `Tarea`: así le aplican la fila de defecto de `.context/backlog/definition-of-done.md` y `bun run jira:closure-evidence` (decisión del dueño del 2026-11-24, auditoría 11).
5. Después del arreglo, repite el experimento y apunta una fila fechada nueva en el registro antes de cerrar la card: esa fila es la prueba de que ya no se reproduce. Un despliegue en verde no lo es.

Hipótesis pendientes de ejecutar: el webhook de Stripe con la base de datos caída y el pago desde la pantalla con Stripe sin responder (FRESCO-1286). El corte de red a mitad de una escritura y la llamada a Stripe que no contesta ya están en las secciones de arriba.

---

**Ver También:**

- [environments.md](./environments.md): por qué los tres ambientes comparten un proyecto Supabase
- [e2e-flaky-triage.md](./e2e-flaky-triage.md): cómo se sigue un fallo intermitente en el CI
