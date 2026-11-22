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
2. **Un fallo transitorio de Auth o de la base se convierte en un `401` y el cliente lo trata como sesión caducada.** En `supabase/functions/_shared/auth.ts`, cualquier `error` de `supabase.auth.getUser()` lanza `HttpError('No autorizado', 401)`, y `callEdgeFunction` redirige a `/login?session_expired=1` ante un 401. Un corte de la base de datos de unos segundos puede cerrar la sesión de quien esté usando la app. Card: FRESCO-1250.

El estado de cada card vive en Jira, no aquí.

---

## Cómo añadir un experimento

1. Escribe la hipótesis **antes** de ejecutar: "si falla X, el usuario ve Y y se recupera en Z".
2. Añade el escenario a `scripts/chaos/local.sh` (un fallo, una forma de deshacerlo).
3. Ejecútalo y apunta una fila nueva en el registro con la fecha, lo que pasó y si la hipótesis se cumplió.
4. Por cada debilidad, abre una card o escribe un test de regresión; un hallazgo sin tarea se olvida.

Hipótesis pendientes de ejecutar: Stripe o su webhook sin responder, y corte de red a mitad de una escritura.

---

**Ver También:**

- [environments.md](./environments.md): por qué los tres ambientes comparten un proyecto Supabase
- [e2e-flaky-triage.md](./e2e-flaky-triage.md): cómo se sigue un fallo intermitente en el CI
