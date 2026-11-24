# Auditoría 11 - pasada de madurez del proyecto (agentic-audit, subject=dev, lens=internal)

Versión en español de `consolidated.md`. Si difieren, manda el original en inglés.

Fecha: 2026-11-24. Objetivo: este repositorio en `3809de78` (`main`, `staging` y `dev` niveladas). Rúbrica: `agentic-audit v1`, `references/rubric-dev.md`, la misma copia local de la skill que usaron las auditorías 9 y 10 (fichero con fecha 2026-11-22; no se volvió a comprobar su commit upstream). Modelo: Opus 5.5, ejecutado como un subagente de la sesión orquestadora. Re-auditoría de la auditoría 10 (2026-11-23, `8d81367d`, 4,3/5).

## 0. Qué es esta pasada y qué no es

El mismo alcance que las auditorías 9 y 10: madurez del proceso frente a la arquitectura agentic-dev, en seis ejes. No es una auditoría de seguridad, pagos, alérgenos ni privacidad, aunque volvió a leer el asesor de seguridad de Supabase alojado (sección 4).

**Cadencia.** Es la tercera pasada en tres días: la auditoría 9 el 2026-11-22, la 10 el 2026-11-23 y esta el 2026-11-24. El delta que se puede medir son 32 commits de primer padre en unas 28 horas: la remediación de la auditoría 10 (FRESCO-1271 a 1282), FRESCO-1249, FRESCO-1251 en tres fases, FRESCO-1262 a 1267, FRESCO-1283 y dos PRs de Dependabot. La §1 de `audit-process.md` llama a las pasadas así de seguidas "measurement churn" (F9). La §2 se cumple: FRESCO-1270 y sus 11 hijas están en `Finalizada` (Jira, leído hoy), así que no hay ninguna épica de remediación abierta y se puede crear una cuando el dueño decida estos hallazgos. La pasada se pidió a través de la sesión orquestadora; esta pasada no vio el motivo del dueño para adelantarla a la fecha regular, así que no queda registrado aquí, y la §2 lo pide. **Decisión del dueño, apuntada el 2026-11-24 después de la entrega:** pasada fuera de ciclo por decisión del dueño; la próxima regular sigue contando desde la auditoría 10 (hacia el 2026-12-23). En ese momento no había ninguna épica de remediación abierta: FRESCO-1270 y sus 11 hijas estaban en `Finalizada`. Los hallazgos fueron a la épica nueva FRESCO-1287, F1 en su propia card y los bajos e informativos agrupados en una card de higiene por eje (FRESCO-1288 a 1293).

**Conflicto de intereses.** Quien audita es la misma familia de agente que escribió buena parte de este repositorio. Los 30 commits no automáticos de la ventana llevan el trailer `Session:` de un agente; ninguno se escribió en esta sesión. Pesa los ejes 3 y 6 en consecuencia.

**Límites que fijó el encargo.** Solo lectura sobre el repositorio; ningún login en un entorno desplegado; ni servidor de desarrollo local ni el stack local de Supabase. Por lo último, el ejercicio de caos que la §6 de `audit-process.md` pide en cada pasada solo se ejecutó en su parte que no necesita el stack, `chaos:stripe-stall` (F8).

## 1. Puntuaciones

| # | Eje | Auditoría 11 | Auditoría 10 | Δ | Por qué se movió |
|---|---|---|---|---|---|
| 1 | Fundación | **4.4** | 4.0 | +0.4 | A10-F2, F3 y F4 están cerrados en el destino: la ADR-0071 enmienda la ADR-0001, el glosario y el SRS nombran la lista blanca de admin, el mapa de API existe y se regeneraron 19 de las 30 secciones del de features. Residuo: el mapa de datos va 24 migraciones por detrás (F6) |
| 2 | Backlog | **4.2** | 4.0 | +0.2 | Las 32 cards que no son épica creadas desde la convención, leídas una a una, llevan `## Criterio de cierre` y épica; los ficheros de roadmap están retirados por una decisión registrada. Hueco nuevo: los defectos que encuentra el caos se tipan como `Tarea` (F1) |
| 3 | Trazabilidad | **4.7** | 4.7 | 0 | 32 de 32 commits convencionales, 13 de 13 commits de código con clave y PR, 30 de 30 con los dos trailers forenses, 4 de 4 despliegues de producción desde un SHA de `staging` en verde. Un override de promoción sin motivo que perdure (F4) |
| 4 | Arquitectura | **4.5** | 4.5 | 0 | A10-F7 está cerrado: la lista de avisos aceptados existe y sus cuatro comprobaciones devuelven 0 filas hoy. Lo compensa lo que destapó el caos: el cliente de Stripe espera 241 s antes de rendirse (en FRESCO-1285) |
| 5 | Verificación | **4.6** | 4.5 | +0.1 | A10-F5 cerrado por decisión (el stack local es el sitio autorizado) y A10-F10 con un script. Nuevo, los dos BAJA: la card del flake cuenta relanzamientos, no fallos (F2); 58 de 59 escenarios solo manuales no tienen verificación vigente (F5) |
| 6 | Disciplina del agente | **4.4** | 4.3 | +0.1 | A10-F1 y F6 están cerrados con evidencia. Pero FRESCO-1283 se cerró con "commit en main y deploy en success" sin la repetición en vivo que su plan preveía: la forma de A10-F6, un día después (F1) |
| | **Global (media simple)** | **4.47** | 4.33 | +0.13 | Con dos decimales para no redondear la media hacia arriba; la auditoría 10 publicó su 4,33 como 4,3 |

El `README.md` sigue valiendo: la tendencia se mide por hallazgos cerrados, no por la nota. Con ese criterio, los 11 hallazgos de la auditoría 10 están cerrados, dos de ellos con residuo (sección 3).

## 2. Hallazgos, ordenados por retorno del esfuerzo

La gravedad es el coste para el propio método del proyecto. No hay hallazgos BLOCKER ni ALTA. "Arrastrado" quiere decir que el hallazgo continúa uno de la auditoría 10; "nuevo", que hace un día no existía o no se veía.

### F1. Los defectos que encuentra el caos se tipan como `Tarea`, así que la puerta de cierre de defectos nunca se ejecuta (Disciplina del agente, MEDIA, problema real, arrastrado en su forma desde A10-F6)

FRESCO-1283 y FRESCO-1284 describen un comportamiento incorrecto que la persona ve, encontrado en las ejecuciones de FRESCO-1251: tras perder la respuesta, la pantalla pide eliminar el menú que se acaba de generar (1283), o revierte una marca que el servidor ya guardó y dice "Vuelve a intentarlo" (1284). Las dos están tipadas como `Tarea`. `definition-of-done.md:36` ata su fila de Defecto al tipo `Error`: la reproducción se reproduce, después deja de reproducirse tras el arreglo, y se rellenan `severity`, `error_type` y `root_cause`. Como `Tarea` no se aplica nada de eso, y las comprobaciones pensadas para defectos no las ven. `scripts/check-closure-evidence.ts:74-81` solo juzga cards `Error` ("Other ticket kinds are never judged here"), así que hoy imprimió "Defects without an epic or a link: 0"; tipada como `Error`, la FRESCO-1283 ya resuelta (épica FRESCO-884, ningún enlace) habría salido en la lista por faltarle el enlace y el script habría salido con 1. El recuento de cards `Error` desde el 2026-10-15 sigue en 15, igual que en la auditoría 10.

Lo que ya ha costado: el plan del arreglo de FRESCO-1283 (comentario 1 en Jira) incluía el paso 4, "Comprobación en vivo en la pila local repitiendo E1". Comentario 2: "Sin verificar: no se repitió E1 en vivo desde la pantalla en la pila local." El comentario 3 cerró la card con "el código ya está en main ... deploy ... estado success". Un estado de deploy es el recibo de la llamada, no el resultado (regla 16 de `AGENTS.md`). El registro de caos no tiene ninguna fila que repita E1 tras el arreglo, aunque su propio precedente es repetir tras arreglar (la fila de `db-restart` tras FRESCO-1250, la del límite de tiempo tras FRESCO-1249), y `docs/workflows/chaos-experiments.md:163` sigue diciendo en presente que la debilidad existe. Nada programa la repetición: la lista de cada pasada (líneas 228-235) cubre `flows`, los cuatro fallos de infraestructura y `stripe-stall`, no E1 a E4. A10-F6 se cerró repitiendo una vez la reproducción de FRESCO-1269, no con una regla, y el hueco volvió en el siguiente defecto.

Lo que limita el daño: el arreglo llevó sus tests en la misma PR (#1078), el segundo comentario dice que los tres tests nuevos fallan con el helper revertido, y la parte sin verificar quedó escrita.

Arreglo (una hora, más o menos): decidir en `definition-of-done.md` si una debilidad de caos con efecto visible es un defecto; si lo es, cambiar FRESCO-1283 y FRESCO-1284 a `Error` con los campos de QA. Repetir E1 en el stack local y apuntar la fila con fecha. Añadir "repite el experimento tras su arreglo y apunta la fila" al paso 4 de "Cómo añadir un experimento".

### F2. La card del flake cuenta relanzamientos, no fallos, y se le escapó la recurrencia de hoy (Verificación, BAJA, problema real, nuevo)

La ejecución del push a `staging` 45422579978 (commit `4c310e59`, 2026-11-24 15:11Z) falló en `test:db-integration` con 761 aprobados y 62 fallos, todos tests HTTP del "real functions runtime" agotando 5000 ms. El paso de diagnóstico que añadió #1022 imprimió el primer candidato a causa: `supabase_edge_runtime_fresco   Exited (135) 6 minutes ago`, un SIGBUS del contenedor del runtime de funciones. No se relanzó; el push siguiente salió en verde. FRESCO-1219, que sigue este flake, está en `WIP`, su último comentario es del 2026-11-22 y su criterio de cierre es "14 días seguidos sin relanzar ningún job del PR Check ... y causa identificada si vuelve a fallar db-integration". Un fallo que el push siguiente deja atrás nunca cuenta, así que la card puede cerrarse el 2026-12-05 con esta recurrencia dentro de su ventana. Los commits de caos de ese push solo tocaron `docs/` y `scripts/chaos/`, así que no son la causa.

La puerta funcionó: en el mismo minuto `edge-functions-drift.yml` se negó a desplegar ("PR Check on 4c310e59 concluded failure; Edge Functions NOT deployed").

Arreglo (15 minutos): añadir la ocurrencia y el código de salida 135 a FRESCO-1219, y contar las ejecuciones fallidas de `test:db-integration` con la firma del bloque entero en vez de los relanzamientos.

### F3. Las cards de resiliencia abiertas están bien escritas; dos huecos de seguimiento (Backlog, BAJA, seguimiento de lo ya conocido)

FRESCO-1284, 1285 y 1286 no se vuelven a reportar. Cada una lleva contexto, evidencia medida, los ficheros que hay que tocar y un `## Criterio de cierre` comprobable, y esta pasada reprodujo la cifra de FRESCO-1285: `bun run chaos:stripe-stall` se rindió a los **241,0 s** con 3 conexiones, lo mismo que el registro. Dos huecos:

- **FRESCO-1285 no nombra el portal de suscripción, que comparte la causa.** `app/api/stripe/portal/route.ts:5,82` usa el mismo cliente `stripe`, creado solo con `apiVersion` (`lib/stripe.ts:85-89`), y `components/profile/manage-subscription-button.tsx:30` hace el POST a `/api/stripe/portal` sin `AbortSignal`. Cambiar `lib/stripe.ts` cubre la mitad del servidor; el botón y el criterio de cierre no.
- **Solo FRESCO-1286 enlaza con FRESCO-1251**, cuyas ejecuciones encontraron las cuatro cards. FRESCO-1283, 1284 y 1285 la nombran en el texto y no tienen enlace. Con el roadmap retirado (FRESCO-1278), el tracker es la única fuente del orden y de los bloqueos.

Arreglo (5 minutos): añadir el portal al alcance y al criterio de FRESCO-1285, y los enlaces `Relates`. El tipo de FRESCO-1284 es F1.

### F4. Un override de promoción no deja un motivo que perdure, y se usó uno fuera de los dos casos documentados (Trazabilidad, BAJA, problema real, nuevo)

`.context/bitacora.md:214`: la promoción de `ebc08055` (toca `.agents/project.yaml`, sin PR) la rechazó `git:promote` y "salió con `--override-reason` autorizado por el dueño". La misma promoción llevaba `3f1aab21`, un commit directo que cambió `.agents/skills/sprint-development/SKILL.md`, `.agents/skills/REGISTRY.md` y `.agents/instructions/agent-project.md`. Ninguno de los dos encaja en `git_strategy.policy.docs_changes` (`docs/**`, `.context/**`, `*.md` de la raíz, `.agents/*.md`). `docs/workflows/promotion.md:28,38` documenta el override para "a confirmed flake or a data migration" y dice que el motivo "is echoed in the output so it leaves a trail". Ese eco vive en un terminal, y la línea de la bitácora no cita el motivo. Como `enforce_admins` está apagado por una divergencia aceptada, `git:promote` es el control compensatorio, y un override que nadie puede releer lo debilita. El proyecto corrigió el rumbo al día siguiente ("lo de skills va por PR", bitácora del 2026-11-24), y los cambios de skills posteriores fueron por #1061 y #1062.

Arreglo (de 30 a 60 minutos): que `git:promote --override-reason` añada la fecha, el SHA y el motivo a un fichero versionado, o que exija una clave de ticket en el motivo.

### F5. 58 de 59 escenarios manuales por decisión no tienen verificación vigente (Verificación, BAJA, problema real, nuevo)

`.context/qa/regression.feature` tiene 214 escenarios: 155 con `@automatizado`, 59 con `@solo-manual` y 0 con `@pendiente` (A9-F9 está cerrado del todo). La regla del propio fichero (líneas 10-14) dice que una etiqueta `@verificado-manual-YYYY-MM-DD` de más de seis semanas "ya no cuenta como garantía vigente". 43 de los 59 llevan etiqueta: 42 tienen más de seis semanas (la más antigua, del 2026-07-29) y una es del 2026-11-24 (el 404 de admin que FRESCO-1267 verificó ese día); 16 no llevan ninguna. Leyendo por encima los comentarios con la razón, 26 de los 59 señalan un test que protege el comportamiento y 33 (el 15 % del catálogo) no; ese reparto no se verificó escenario a escenario. Nada vuelve a verificar ese conjunto con una cadencia, así que, según el propio estándar del proyecto, 58 de los 59 no tienen prueba vigente. *Corregido el 2026-11-24, después de entregar el informe: la primera versión decía 33 con etiqueta y 26 sin ella, la más reciente del 2026-08-19; el recuento lee las etiquetas de cada bloque de escenario.*

Arreglo: o volver a verificar el conjunto en el stack local en cada pasada de auditoría (encaja con F8), o nombrar en el comentario de cada escenario el test que lo protege y quitar la etiqueta de fecha. Un script corto que liste las etiquetas caducadas hace cumplible la regla de las seis semanas.

### F6. El mapa de datos va 24 migraciones por detrás (Fundación, BAJA, residuo de A10-F4)

`business-data-map.html` dice "generated 2026-10-29" (último commit el 2026-10-30), y desde entonces se añadieron 24 migraciones. No menciona `analytics_consent_at` ni `analytics_consent_version` (`20261105130000_analytics_consent_version.sql`), ni `recorrido_visto` (`20261112100000_user_profiles_tour_seen.sql`); sigue describiendo solo `analytics_consent`. A10-F4 nombraba los mapas de API y de features, y los dos se arreglaron. El coste está acotado: `stack.database.schema_source` es `migrations`, así que las migraciones siguen siendo la fuente de verdad del esquema.

Arreglo: ejecutar `project-context` en modo UPDATE para el mapa de datos, que regenera solo las secciones desfasadas. Una sesión.

### F7. La única pieza sin verificar de Dependabot #1053 vive solo en la bitácora (Verificación, INFORMATIVO, nuevo)

`posthog-node` pasó de la 5 a la 6 y llegó a `main` en #1053. La bitácora dice que la PR se revisó ("la API de posthog-node que usamos no cambia, el endpoint de captura pasa a la ruta v1") y deja un punto abierto: "confirmar con el primer pago con consentimiento que el evento llega a PostHog por la ruta nueva" (`.context/bitacora.md:239-240`). El cliente de servidor (`lib/posthog/server.ts`) solo se llama desde el webhook de Stripe y desde `lib/billing/grant-pro.ts:78`, los eventos del embudo de facturación. Ninguna card guarda esa comprobación. La ejecución semanal de `stripe-e2e.yml` ejercita el webhook en `staging`, y nadie lee PostHog después.

Arreglo (10 minutos): una card que consulte en PostHog los eventos del webhook tras la próxima ejecución semanal de Stripe.

### F8. La §6 de `audit-process.md` pide en cada pasada una ejecución de caos en el stack local que una pasada de solo lectura no puede hacer (Verificación, INFORMATIVO, pregunta)

La §6 (añadida el 2026-11-24 en `cbc02f1a`) y las líneas 228-235 de `chaos-experiments.md` piden que cada pasada arranque el stack local y ejecute `flows`, cuatro escenarios de fallo y `stripe-stall`. Esta pasada se encargó en solo lectura y sin stack local, así que solo se ejecutó `stripe-stall` (241,0 s, sin cambios). El paso 3 compara con "el límite que acuerde FRESCO-1285", que todavía no existe. Pregunta para el dueño: ¿la ejecución de caos forma parte de la pasada de auditoría (y entonces el encargo de auditoría tiene que permitir el stack local) o es un paso aparte cuya fila fechada del registro lee la auditoría (y entonces la §6 debería decir qué antigüedad puede tener esa fila)? **Respondida el 2026-11-24:** un paso aparte, que ejecuta la sesión de trabajo justo antes de cada pasada; la auditoría lee la fila fechada de esa misma semana (FRESCO-1289).

### F9. Tercera pasada en tres días (Disciplina del agente, INFORMATIVO, pregunta)

La §1 de `audit-process.md` fija una cadencia mensual porque las pasadas más seguidas miden ruido y compiten con la remediación por el tiempo de una sola persona. Las auditorías 9, 10 y 11 se hicieron en días consecutivos, y esta mide 32 commits. Pregunta: ¿esta es la pasada regular (la siguiente caería hacia el 2026-12-24) o una fuera de ciclo (la siguiente regular se queda hacia el 2026-12-23)? Apunta la respuesta en la fila del `README.md`, que esta pasada no escribió. **Respondida el 2026-11-24:** fuera de ciclo; la próxima regular, hacia el 2026-12-23 (sección 0).

## 3. Hallazgos de la auditoría 10, comprobados de nuevo

| Auditoría 10 | Estado | Comprobado hoy con |
|---|---|---|
| F1 contraseña en un snapshot | Cerrado | la regla está en `live-ui-validation.md` §3.3 (enviar con `run-code`, recuento que solo imprime un número), en las Compact Rules de `sprint-development` (`SKILL.md:22`) y en `REGISTRY.md:670`; el recuento de `.playwright/` da 0 para cada una de las seis contraseñas de prueba de los entornos desplegados |
| F2 preferencias blandas frente a la ADR-0001 | Cerrado | ADR-0071 `Accepted`; línea de enmienda en la ADR-0001; fila "Soft preference" en el glosario y la entrada del antiglosario; el texto del onboarding coincide |
| F3 rol de admin | Cerrado | `domain-glossary.md:30` y `.context/SRS/architecture.md:187` nombran la lista blanca |
| F4 mapas de negocio | Cerrado, con residuo | mapa de API generado el 2026-11-23; 19 de 30 secciones del de features regeneradas (cita 28 tickets FRESCO-12xx); los tres mapas `.md` heredados, marcados como sustituidos; `docs/boilerplate.md:322-324` corregido; el SRS lleva una nota de validez; el mapa de datos va por detrás (F6) |
| F5 pantallas autenticadas | Cerrado por decisión | `live-ui-validation.md` §3.6; no se ejercitó en esta pasada (sección 6) |
| F6 puertas de cierre de FRESCO-1269 | Cerrado, el patrón vuelve | `root_cause=code_error`, `severity=moderada`, `error_type=functional`; el mismo hueco volvió en FRESCO-1283 (F1) |
| F7 lista del asesor | Cerrado | `docs/workflows/supabase-advisor-accepted.md`; el asesor en vivo muestra 27 WARN y 17 INFO, todos en sus cuatro familias; sus cuatro consultas de comprobación devuelven 0 filas |
| F8 ficheros de roadmap | Cerrado por decisión | aviso RETIRED en los dos ficheros; override de la Fase 0b en `sprint-development/SKILL.md:325`; "Retired planning files" en `agent-project.md` |
| F9 criterios de cierre | Cerrado | la JQL de la §5 devuelve 0; las 32 cards que no son épica creadas desde el 2026-11-23 llevan el encabezado y épica, leídas una a una |
| F10 tiempo de reloj del e2e | Cerrado | `bun run ci:e2e-wallclock` existe y funciona (cifras abajo) |
| F11 prefijos de rama | Cerrado | comentario sobre `branch_prefixes.precedence` (FRESCO-1281); 18 de 18 ramas de PR humanas de la ventana siguen `{prefix}/FRESCO-N-slug` |

### Comprobaciones fijas que el proceso pide repetir en cada pasada

| Comprobación | Resultado hoy | Tendencia |
|---|---|---|
| JQL de la §5 de `audit-process.md` (criterio de cierre, creadas desde el 2026-11-24) | **0** | primera ejecución de esta comprobación |
| JQL de la §2 de `audit-process.md` (cards abiertas sin épica) | **0** | 0 en la auditoría 10 |
| `bun run ci:e2e-wallclock` (12 últimas ejecuciones en verde de `staging`) | media **5m49s**, máximo **6m32s**; una ejecución por encima de 6m30s (14:37Z), nunca dos seguidas, así que el disparador de la ADR-0018 no ha saltado | informe de la auditoría 10: media 365 s, máximo 393 s; bitácora del 2026-11-24 por la mañana: máximo 6m27s. Plana, con mucha dispersión (de 4m44s a 6m32s) |
| `bun run jira:closure-evidence` | 61 cerradas en 7 días, 0 sin comentario; 0 defectos sin épica o sin enlace | solo juzga cards `Error` (F1) |
| Caos (§6) | solo `stripe-stall`: 241,0 s, 3 conexiones | sin cambios; el resto no se ejecutó (F8) |
| `bun run test` | 7563 tests en 572 ficheros: 6819 aprobados, 744 omitidos, 0 fallos, 85 s | los omitidos son la suite de integración con la base de datos (`RUN_DB_INTEGRATION`, 83 ficheros), que ejecuta su propio job de CI |
| `bun run types:check` | limpio | |
| `bun run lint:check` | 0 errores, 4 avisos | los cuatro son anteriores a la auditoría 10 (por ejemplo `EdgeErrorBody`, sin usar desde FRESCO-1072) |
| `bun run git:checks verify` y `bun run git:policy verify` | los cinco checks declarados son obligatorios en `main`, `staging` y `dev`; 0 desviaciones; force-push y borrado bloqueados | |
| Ejecuciones del `PR Check` de `staging` desde la auditoría 10 | 30 de 31 en verde; la roja es F2 | |

## 4. Lo que respalda la evidencia

Medido o citado, no elogio genérico.

- **La remediación de la auditoría 10 se cerró con evidencia, y rápido.** Once hallazgos pasaron por FRESCO-1271 a 1281, más FRESCO-1282 para el hueco que destapó el mapa de features, entre el commit del informe (2026-11-23 18:46) y la entrada de cierre de la épica (2026-11-24 11:09). Cada uno se sostiene en el destino (sección 3), no solo en el tracker.
- **Cada cambio de la ventana es trazable.** 32 de 32 commits de primer padre son convencionales; 13 de 13 commits `feat`, `fix`, `refactor`, `perf` y `test` llevan una clave `FRESCO-` y un `(#PR)`; 30 de 30 commits no automáticos llevan `Worktree:` y `Session:`; ninguna atribución a IA; tamaño de commit con mediana de 2 ficheros y máximo de 18.
- **La puerta de promoción aguantó.** 4 de 4 despliegues de producción desde el 2026-11-23 a las 16:00 UTC salieron de un SHA cuyo `PR Check` del push a `staging` pasó, y 4 de 4 tuvieron el smoke posterior en verde.
- **Una puerta saltó bien ante un fallo real.** En la ejecución roja del 2026-11-24 a las 15:11Z, el autodespliegue de Edge Functions se negó a publicar, y su comparación de deriva siguió pasando.
- **La frontera de la base de datos queda registrada, no se reinvestiga.** La página de avisos aceptados lista familias, nunca recuentos, y da una consulta de solo lectura por familia. Las cuatro devuelven 0 filas hoy; el asesor en vivo muestra 27 WARN y 17 INFO, todos dentro de esas familias.
- **Las capas se respetan.** `cycles:check`: 485 ficheros, ningún ciclo. Cero imports de `lib/` hacia `components/` o `app/`, cero de `components/` hacia `app/`, ningún color en crudo nuevo. Las llamadas a Edge Functions pasan por un único helper con límite de tiempo por función (FRESCO-1249).
- **El caos se hace con la hipótesis primero.** `chaos-experiments.md` escribe cada hipótesis antes de ejecutar y dice lo que no se midió: "**Lo que no se midió:** qué corta primero, el SDK o el límite de duración de la función en Vercel." Su cifra de S1a se reprodujo aquí al decimal.
- **La persona dirige, y dice lo que no está verificado.** `.context/bitacora.md`, 2026-11-24: la revisión independiente de #1064 "halló un fallo real (un guardado reenviaba objetivo y nivel y podía pisar un valor más nuevo), corregido antes de mergear"; la card de FRESCO-1282 "pedía mal bloquear a Free en la base de datos: el onboarding de Free escribe esas columnas, así que el bloqueo es solo de pantalla"; `jira:closure-evidence` "destapó dos cierres sin comentario, FRESCO-1274 (mío) y FRESCO-1240".
- **Los registros de decisión siguen siendo coherentes.** `adr:check`: 71 ADRs, índice completo, ninguna `Proposed` caducada. El SRS dice ahora que es el contrato del MVP y que "does not describe everything the product does today", en vez de desfasarse en silencio.
- **Higiene de credenciales.** Recuento de `.playwright/`: 0 para las seis contraseñas de prueba de los entornos desplegados. Ningún patrón de token en los ficheros cambiados desde la auditoría 10. `.env` nunca se commiteó.

## 5. Superficie en vivo

Solo lectura y anónima sobre `fresco-pre`, con una sesión de navegador lanzada desde el directorio temporal y cerrada al final.

- **`/` a 390 y 1440 px.** `lang="es"`, un `h1`, 15 encabezados sin saltos, 20 de 20 imágenes con `alt`, sin desbordamiento horizontal en ninguno de los dos anchos. Los únicos objetivos por debajo de 24 px son dos enlaces en línea dentro de frases (uno en el texto de consentimiento de la lista de espera), que la WCAG 2.5.8 exime. `responseStart` 110 ms, `domContentLoadedEventEnd` 1390 ms, carga 2117 ms, LCP 1472 ms en Chrome de escritorio sin limitar (no es una cifra de campo), CLS 0,000.
- **Consola.** 0 errores. Dos avisos, los dos causados por la propia llamada de medición de esta pasada (una API de rendimiento obsoleta), no por la app.
- **`/legal/privacidad` a 390 px**, que no habían medido pasadas anteriores: `lang="es"`, un `h1`, 9 encabezados sin saltos, sin desbordamiento, ningún mensaje en consola.
- **Redirecciones anónimas y salud.** `/calendar`, `/shopping-list`, `/profile` y `/admin/recipes` responden 307 a `/login?next=…`, y `/menu` responde 307 a `/login`, igual que en la auditoría 10. `/api/health` responde `{"status":"ok","checks":{"app":"ok","supabase":"ok"}}` (1,9 s, un arranque en frío). `staging` sirve un `robots.txt` con `Disallow: /` y un sitemap vacío; el sitemap de producción lista seis URLs públicas.

## 6. Puntos ciegos

- **La app autenticada no se ejercitó en ningún sitio en esta pasada**: ni login en entornos desplegados ni stack local, por encargo. `/profile/preferences` de FRESCO-1282, los mensajes de límite de tiempo de FRESCO-1249 y el arreglo de FRESCO-1283 están sin medir en vivo.
- **Caos (§6)**: solo se ejecutó `stripe-stall` (F8).
- **`.env.ci` no se abrió** (regla 1; el arnés también rechazó una lectura solo de nombres), así que las contraseñas de prueba del stack local no entraron en el recuento. `.playwright/output/` guarda 76 snapshots de página escritos hoy entre las 15:36 y las 15:38 hora local; no se abrieron. Después de la entrega (2026-11-24), un recuento sin mostrar valores dio 0 para las seis contraseñas de prueba de los entornos desplegados y la carpeta se vació (FRESCO-1293).
- **Qué commit sirve `fresco-pre`** no se confirmó; las páginas medidas no cambiaron en la ventana.
- **Ajustes alojados.** Solo se leyeron el asesor de seguridad y las cuatro consultas de comprobación. Ni el asesor de rendimiento, ni los ajustes de Vercel, ni los de Auth.
- **La calidad de los tests** se contó, no se muestreó; ninguna ejecución de mutación aparte de la evidencia que cita el comentario de FRESCO-1283.
- **La fidelidad de diseño** (tokens de `DESIGN.md`, registros de divergencia por pantalla) no se volvió a comprobar.
- **El motivo del dueño para esta pasada** llegó a través de la sesión orquestadora y no se vio de primera mano.

## 7. Orden de trabajo sugerido (no es un plan, no se han creado cards)

1. **F1:** decidir si una debilidad de caos es un defecto, cambiar el tipo de FRESCO-1283 y 1284, repetir E1 y apuntar la fila.
2. **F2 y F3:** un comentario en FRESCO-1219, el portal añadido a FRESCO-1285 y tres enlaces `Relates`.
3. **F4:** que el motivo del override perdure.
4. **F5 y F8:** decidir quién ejecuta las comprobaciones del stack local (el caos y los escenarios solo manuales) y cuándo.
5. **F6:** refrescar el mapa de datos.
6. **F7 y F9:** una card para la comprobación de PostHog; apuntar la decisión de cadencia en la fila del `README.md`.
