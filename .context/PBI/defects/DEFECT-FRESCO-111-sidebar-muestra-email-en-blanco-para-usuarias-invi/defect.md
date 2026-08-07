# DEFECT: Sidebar muestra email en blanco para usuarias invitadas

**Jira Key:** [FRESCO-111](https://basiliomontescastano.atlassian.net/browse/FRESCO-111)
**Priority:** Medium
**Status:** WIP
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/layout/sidebar-account.tsx` (`user_email`)
- ***Pasos para reproducir***: entrar como invitada, generar un menú, mirar el sidebar (desktop).
- ***Esperado***: algún placeholder tipo "Invitada" — exactamente lo que ya hace `app/(app)/profile/page.tsx` (`user?.email ?? 'Invitada'`) para el mismo caso.
- ***Observado***: `sidebar-account.tsx` renderiza `{email}` sin fallback — para una sesión anónima `email` es `""`, así que se ve una línea en blanco bajo "Sin nombre". Es puramente cosmético pero es una inconsistencia real entre dos componentes que resuelven el mismo dato.

## Por qué importa

Inconsistencia visual entre dos superficies que muestran el mismo dato de cuenta; puede leerse como un bug de carga de datos aunque es puramente cosmético.

## Alcance

Aplicar el mismo fallback que ya usa `app/(app)/profile/page.tsx`: `email ?? 'Invitada'`.

## Cómo reproducir

1. Entrar sin login (modo invitada).
2. Generar un menú.
3. Mirar el sidebar de cuenta en escritorio (1280px).

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/7/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
