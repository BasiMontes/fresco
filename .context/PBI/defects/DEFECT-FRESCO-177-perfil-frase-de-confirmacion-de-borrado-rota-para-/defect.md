# DEFECT: Perfil: frase de confirmación de borrado rota para invitados (doble espacio)

**Jira Key:** [FRESCO-177](https://basiliomontescastano.atlassian.net/browse/FRESCO-177)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/profile/delete-account-dialog.tsx` línea ~77 — el párrafo de advertencia interpola `<strong>{email}</strong>`; para invitados `email` es `""`.
- Hallazgo del QA sweep (agente Lista+Perfil, MINOR): la frase se lee "Escribe  para confirmar." con doble espacio visible, mismo origen que FRESCO-167.

## Cambio propuesto

- Se resuelve junto con FRESCO-167 (la solución de confirmación alternativa para invitados también arregla esta frase). Si se implementa por separado: agregar fallback de texto (ej. "tu cuenta") cuando `email` está vacío.

## Alcance

- Solo `delete-account-dialog.tsx`. Depende de/relacionado con FRESCO-167.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
