# DEFECT: /qa en móvil: bloques de código sin señal visual de scroll horizontal

**Jira Key:** [FRESCO-268](https://basiliomontescastano.atlassian.net/browse/FRESCO-268)
**Priority:** Low
**Status:** Finalizada
**Components:** None

---

## Description

## Contexto

Auditoría externa (Dojo, Ely, 14 ago 2026), medida a 390px: 12 bloques de código en `/qa` se salen de su caja — uno mide 783px dentro de un contenedor de 300px. El scroll horizontal sí funciona (`overflow-x-auto`), pero no hay ninguna señal visual de que el contenido se pueda deslizar. `/qa` es justo la página que un evaluador externo de QA va a abrir primero, y probablemente desde el móvil.

Verificado en código el 26 ago 2026: `components/qa/code-block.tsx` tiene `overflow-x-auto` en el contenedor, confirmando que el scroll funciona, pero sin ningún indicador visual de borde.

El patrón que hace falta ***ya existe en el propio repo*** y nunca se portó: `components/calendar/calendar-grid.tsx` resuelve exactamente este problema con un degradado en el borde (`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 ... from-background to-transparent`), shippeado en FRESCO-184.

## Solución propuesta

Portar el mismo patrón de degradado de `calendar-grid.tsx` al wrapper `overflow-x-auto` de `components/qa/code-block.tsx`. Sin diseño nuevo: es reutilización directa de un patrón interno ya validado.

## Plan de acción

1. Extraer o replicar el degradado de borde de `calendar-grid.tsx` (mismo enfoque: capa `pointer-events-none` posicionada sobre el borde derecho del contenedor con scroll).
2. Aplicarlo en `components/qa/code-block.tsx`, idealmente condicionado a que el contenido realmente desborde (igual que en el calendario), no siempre visible.
3. Verificar a 390px que la señal aparece en los bloques de código que desbordan (el diagrama de arquitectura, por ejemplo) y no en los que no.

---

## Metadata

- **Created:** 8/26/2026
- **Updated:** 8/26/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-dojo

---

_Synced from Jira by sync-jira-issues_
