# EPIC: Lista de la Compra

**Jira Key:** [FRESCO-12](https://basiliomontescastano.atlassian.net/browse/FRESCO-12)
**Priority:** Medium
**Status:** Listo
**Total Story Points:** 0

---

## Description

Convierte el menú semanal generado en una lista de la compra agrupada por pasillo, con cantidades consolidadas entre las 21 comidas. El backend real (generación de la lista, consolidación determinista de ingredientes, y el toggle de comprado) ya existe y funciona de principio a fin, salvo el texto exacto de clasificación de pasillos enviado al modelo; el frontend hoy es un shell con datos de ejemplo que ya tiene la forma exacta de la respuesta real.

Depende de Generación de Menú (FRESCO-6) — necesita un plan generado y persistido para poder construir la lista. No reimplementa la generación del menú ni el calendario editable — son épicos separados.

Valor de negocio: convierte la semana planificada en una compra real sin traducción mental adicional, con una lista organizada por pasillo en lugar de un simple volcado de ingredientes (paso 4 del recorrido de Laura).

---

## User Stories

| Key | Story | Points | Priority | Status |
| --- | ----- | ------ | -------- | ------ |
| [FRESCO-13](https://basiliomontescastano.atlassian.net/browse/FRESCO-13) | Lista de la Compra | Generar y marcar como comprados los ingredientes del menú semanal | - | Medium | Control de calidad |

---

## Metadata

- **Created:** 7/27/2026
- **Updated:** 7/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
