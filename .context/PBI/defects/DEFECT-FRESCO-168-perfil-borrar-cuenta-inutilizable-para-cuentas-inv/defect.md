# DEFECT: Perfil: 'Borrar cuenta' inutilizable para cuentas invitadas

**Jira Key:** [FRESCO-168](https://basiliomontescastano.atlassian.net/browse/FRESCO-168)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/profile/delete-account-dialog.tsx` línea ~33 — `isConfirmed = typedEmail.trim() === email`. Para cuentas invitadas `email` es `""`, así que ningún input (ni vacío) puede igualarlo nunca.
- Hallazgo del QA sweep (agente Lista+Perfil, MAJOR): el botón de confirmar queda permanentemente deshabilitado para invitados. Falla cerrado (seguro, sin riesgo de borrado accidental) pero contradice la copy del propio FAQ ("puedes... borrar tu cuenta de forma definitiva" — `ayuda-section.tsx` línea ~48) y deja a los invitados sin autoservicio real para borrar sus datos.

## Cambio propuesto

- Para cuentas invitadas (email vacío), usar una frase de confirmación alternativa que no dependa de escribir un email (ej. escribir literalmente "BORRAR", o un checkbox + botón simple ya que no hay email real que perder). Evaluar con el user cuál patrón prefiere antes de implementar — hay más de una solución razonable.

## Alcance

- Solo `delete-account-dialog.tsx`. Relacionado con FRESCO-168 (mismo archivo, frase rota con doble espacio).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/18/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
