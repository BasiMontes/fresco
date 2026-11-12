# Triage de un escenario e2e flaky

> **Idioma:** Español
> Cómo encontrar la causa de un escenario que falló en su primer intento y pasó al reintentar, usando lo que guarda cada ejecución de `PR Check`.

---

## Qué guarda cada ejecución

El job `test:e2e` sube dos artefactos (retención de 7 días):

| Artefacto         | Qué contiene                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `playwright-report` | Informe y trazas de Playwright. El `error-context.md` de cada fallo trae la pantalla en el momento del fallo |
| `supabase-logs`   | Un log por contenedor de la pila local: Edge runtime, pasarela (Kong), PostgREST y Auth (FRESCO-1202) |

El paso `e2e flakiness budget` del log solo imprime **cuántos** escenarios fueron flaky. Los nombres salen en las líneas `flaky e2e scenario (passed on retry): <nombre>` del mismo log.

## Cómo seguir una pista

1. En el log del job `test:e2e`, busca `flaky e2e scenario` para saber qué escenario fue y la hora del primer intento.
2. Descarga `playwright-report` y lee el `error-context.md` de ese escenario: el error y la pantalla en ese momento.
3. Si el error es un 5xx de una siembra o de una función (`502`, o `500` con el cuerpo genérico `Error guardando el plan en la BD`), descarga `supabase-logs` y busca en `supabase_edge_runtime_*.log` la línea de esa hora. `create_meal_plan failed` lleva el mensaje real de la base de datos. En `supabase_kong_*.log` se ve si la pasarela respondió el 502.
4. Con la causa, decide: un reintento solo si es un fallo de transporte (`sendSeedRequest`), un arreglo si es de la función o del test.

Los logs enmascaran los JWT, pero no se debe pegar su contenido en tarjetas ni PRs sin revisarlo. El artefacto cubre la ejecución en curso: un fallo antiguo ya no tiene su log.
