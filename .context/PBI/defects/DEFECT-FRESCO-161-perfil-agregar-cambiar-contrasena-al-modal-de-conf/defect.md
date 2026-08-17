# DEFECT: /perfil: agregar 'Cambiar contraseña' al modal de Configuración

**Jira Key:** [FRESCO-161](https://basiliomontescastano.atlassian.net/browse/FRESCO-161)
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/profile/ayuda-section.tsx` — modal "Configuración" (líneas ~102-128), hoy solo lectura (Email, Plan actual, Miembro desde).
- Hallazgo directo del user: comparado con la versión antigua de la app (que tenía nombre+email editables y cambio de contraseña), la Configuración actual no permite ninguna acción real.
- Decisión del user tras pregunta de scope: agregar ***solo*** cambio de contraseña — no editar email (más superficie de cambio, requiere confirmación por email de Supabase Auth).

## Cambio propuesto

- Agregar un botón "Cambiar contraseña" dentro del modal de Configuración que dispare `supabase.auth.resetPasswordForEmail(email)` — reutiliza el flujo de recuperación ya existente (`app/update-password/page.tsx`, FRESCO-52) en vez de construir un formulario de contraseña-actual + contraseña-nueva desde cero. Confirmación visual de "email enviado" tras el click.

## Alcance

- Solo `ayuda-section.tsx`. No toca `app/update-password/page.tsx` (se reutiliza tal cual). No agrega edición de email ni de nombre (ya existe `NombreForm` en la página principal).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/10/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
