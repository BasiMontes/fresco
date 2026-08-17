# DEFECT: Perfil: campo Email en blanco en Configuración para invitados

**Jira Key:** [FRESCO-178](https://basiliomontescastano.atlassian.net/browse/FRESCO-178)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/profile/ayuda-section.tsx` — el modal Configuración muestra `{email}` crudo; para invitados es `""`.
- Hallazgo del QA sweep (agente Lista+Perfil, MINOR): el campo "Email" aparece completamente en blanco, sin texto de respaldo — se lee como un campo roto.

## Cambio propuesto

- Mostrar un fallback tipo "Cuenta de invitado" cuando `email` está vacío, mismo criterio que otros lugares de la app ya usan (`user?.email ?? 'Invitada'`).

## Alcance

- Solo esa línea en `ayuda-section.tsx`.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
