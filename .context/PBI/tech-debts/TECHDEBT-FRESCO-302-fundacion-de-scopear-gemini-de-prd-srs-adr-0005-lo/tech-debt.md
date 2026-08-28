# Tarea: Fundación: de-scopear Gemini de PRD/SRS (ADR-0005 lo eliminó; docs aún lo describen activo)

**Jira Key:** [FRESCO-302](https://basiliomontescastano.atlassian.net/browse/FRESCO-302)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Descubierto durante la regeneración de los mapas de negocio (PR #169). `ADR-0005` (Aceptado) eliminó Gemini de producción: la selección de menú (`menu-selector.ts`) y la explicación de aprendizaje Pro (`prompt.ts`) son ahora 100% deterministas, y `generate-shopping-list` también. No queda ninguna llamada a Gemini en el código.

## Hallazgo

***PRD y SRS siguen describiendo Gemini como el motor activo.*** Sitios concretos que contradicen ADR-0005:

- `SRS/architecture.md` §diagrama Mermaid — `Gemini[[Gemini Flash]]`, flechas `GenMenu -->|system + user prompt| Gemini`, `GenList -->|classify + normalize| Gemini`. §77 tabla "AI model: Gemini Flash" con lock-in a `gemini-1.5-flash`. §90 paso 7 "calls Gemini Flash".
- `SRS/functional-requirements.md` FR-2 "call Gemini Flash with responseMimeType", FR-8.1 "Layer 2: the Gemini Flash system prompt's REGLAS ABSOLUTAS", FR-2.6 shopping-list "send only the consolidated list to Gemini Flash for aisle classification".
- `SRS/non-functional-requirements.md` NFR-PERF-1 "including the Gemini Flash call", NFR-SEC-3 "The Gemini API key must never be exposed" (`GEMINI*API*KEY`), NFR-REL-1 "Both Gemini-calling Edge Functions retry on invalid model output, MAX_RETRIES = 2".
- `SRS/api-contracts.md` §82 "a genuine 502 upstream Gemini failure".

## Solución propuesta

Correr `/project-foundation` (fase Architecture/SRS) o parchear a mano cada sitio para reflejar ADR-0005: motor determinista, sin llamadas a IA, sin `GEMINI*API*KEY`, `NFR-PERF-1` sin la latencia del modelo, `NFR-REL-1` sin el retry-de-modelo (la validación determinista no reintenta). Actualizar el diagrama de `architecture.md`.

También `FR-8.1` describe "two independent layers" (SQL + prompt del modelo) — con ADR-0005 la capa 2 es la exclusión determinista en `menu-selector.ts`, no un prompt.

## Retorno esperado

PRD/SRS vuelven a ser fuente fiable para planificar y escribir AC. CLAUDE.md dice que se consultan antes de escribir AC — hoy inducen a error sobre la arquitectura real.

---

## Fields

### Clasificación

0|i001w7:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
