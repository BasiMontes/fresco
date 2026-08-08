# DEFECT: /qa page se autocontradice: dice 'IA' en la cabecera y '100% determinista' dos secciones después

**Jira Key:** [FRESCO-127](https://basiliomontescastano.atlassian.net/browse/FRESCO-127)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

Qué se observa

Dónde: app/qa/page.tsx (líneas ~50 y ~61-62)

Pasos para reproducir:
1. Abrir /qa (Software Testability Guide).
2. Leer el párrafo de cabecera y, dos secciones más abajo, la sección sobre selección de menú.

Esperado: el propio /qa page, cuya audiencia es QA/evaluadores técnicos, debería describir la arquitectura real con precisión.

Observado: la cabecera dice "...con una capa de generación asistida por IA", pero dos secciones después afirma "Selección de menú... son 100% deterministas — sin llamadas a modelos de IA en producción" — se contradice a sí mismo en la misma página. Copy desactualizada desde la eliminación de Gemini (2026-08-01, ADR-0005).

Por qué importa

Es la página diseñada específicamente para informar con precisión a QA/evaluadores — la autocontradicción mina su propósito.

Alcance

Quitar o corregir la frase de cabecera "generación asistida por IA" para que coincida con la sección determinista que la contradice.

Cómo reproducir

Ver Pasos para reproducir arriba.


---

## Metadata

- **Created:** 8/8/2026
- **Updated:** 8/8/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** minor, qa-sweep-2026-08-08

---

_Synced from Jira by sync-jira-issues_
