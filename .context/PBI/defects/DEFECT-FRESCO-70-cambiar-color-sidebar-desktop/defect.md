# DEFECT: Cambiar color sidebar desktop

**Jira Key:** [FRESCO-70](https://basiliomontescastano.atlassian.net/browse/FRESCO-70)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

`components/layout/sidebar.tsx:30` — el sidebar de escritorio usa `bg-accent-900` (`#011101`, verde muy oscuro, casi negro).

## Importante — esto NO es un bug de implementación

El color actual coincide EXACTAMENTE con lo documentado en DESIGN.md (líneas 193-194 y 296), que describe este sidebar como **"la única superficie del sistema donde se usa el extremo oscuro de la rampa accent"** y advierte explícitamente **"nunca reusar en otro lado"**. El propio comentario del componente (líneas 10-17) restata esta decisión a propósito.

Este ticket es un pedido de ***cambiar*** el diseño establecido, no de corregir un mismatch entre código y spec.

## Alcance real

1. Definir el nuevo color de destino (pedir referencia/mockup al reporter).
2. Actualizar el token `nav-sidebar` en `DESIGN.md`.
3. Verificar contraste del logo "negativo" contra el nuevo color — ese logo está atado específicamente a este fondo oscuro.

## Pendiente del reporter

¿Qué color se busca? (código hex, referencia visual o mockup)

---

## Metadata

- **Created:** 8/4/2026
- **Updated:** 8/5/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
