# DEFECT: El enlace de confirmación de email siempre apunta a producción, aunque el registro sea en staging

**Jira Key:** [FRESCO-264](https://basiliomontescastano.atlassian.net/browse/FRESCO-264)
**Related Story:** [FRESCO-250](https://basiliomontescastano.atlassian.net/browse/FRESCO-250) - Confirmación de signup redirige a /menu en vez de /onboarding
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Contexto

Encontrado durante un QA exploratorio de primer uso en staging (`fresco-pre.vercel.app`).

## Pasos para reproducir

1. Ir a `fresco-pre.vercel.app` → "Empezar gratis" → "Crear cuenta".
2. Registrarse con un email nuevo.
3. Abrir el correo de confirmación recibido.
4. Pulsar "Confirmar mi cuenta".

## Resultado

El enlace del correo apunta a `https://fresco-pro.vercel.app/auth/confirm?token_hash=...&type=signup&next=/onboarding` sin importar el entorno de origen. El usuario termina autenticado en PRODUCCIÓN, no en staging. La pestaña original de staging queda sin sesión (huérfana).

## Hipótesis de causa raíz

El Site URL / redirect base de Supabase Auth es global (no depende del entorno), aunque los tres entornos (`local`, `staging`, `production`) comparten el mismo proyecto Supabase (`jdqemhewjrjuopssdurn`, ver `.agents/project.yaml`). Revisar la configuración de Auth → URL Configuration / Redirect URLs en el dashboard de Supabase, y si el email se genera server-side, la variable de entorno usada para construir el link de confirmación.

Nota: distinto de FRESCO-254 (que arregló la ruta `/auth/confirm` en sí) — aquí la ruta es correcta, el dominio base no lo es.

---

## Related Issues

- relates to: [FRESCO-250](https://basiliomontescastano.atlassian.net/browse/FRESCO-250) - Confirmación de signup redirige a /menu en vez de /onboarding
- relates to: [FRESCO-18](https://basiliomontescastano.atlassian.net/browse/FRESCO-18) - Registro Progresivo

---

## Metadata

- **Created:** 8/25/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** cross-environment, qa-exploratorio

---

_Synced from Jira by sync-jira-issues_
