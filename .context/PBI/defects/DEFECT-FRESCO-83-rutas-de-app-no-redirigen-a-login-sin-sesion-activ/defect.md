# DEFECT: Rutas de (app)/ no redirigen a login sin sesión activa

**Jira Key:** [FRESCO-83](https://basiliomontescastano.atlassian.net/browse/FRESCO-83)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

Navegar directo a cualquier ruta bajo `(app)/` (`/menu`, `/calendar`, `/recipes`, `/profile`, etc.) sin sesión activa NO redirige a `/login`. `proxy.ts` (el middleware renombrado en Next.js 16) solo refresca la cookie de sesión vía `auth.getUser()` — nunca redirige si no hay usuario. `app/(app)/layout.tsx` tampoco tiene guard (`if (!user) redirect('/login')`).

## Por qué importa

Descubierto durante el code review de FRESCO-82 (footer de cuenta en el sidebar). Sin este guard, cualquier visitante sin sesión que navegue directo a una URL protegida ve el shell de la app renderizado con datos vacíos/degradados en vez de ser redirigida a `/login`. FRESCO-82 mitigó el síntoma visible en su propio componente (el footer de cuenta ya no se muestra sin sesión activa), pero el resto de cada pantalla bajo `(app)/` sigue renderizando sin protección real.

## Alcance

1. Agregar guard de sesión en `app/(app)/layout.tsx` (`redirect('/login')` si no hay usuario) o extender `proxy.ts` para proteger el route group `(app)`.
2. Confirmar que Modo Invitado (sesión anónima de Supabase, FRESCO-16) sigue funcionando sin verse afectado — ese flujo SÍ tiene sesión (anónima), no debería redirigir.

## Cómo reproducir

1. Sin sesión (cookies limpias), navegar directo a `/menu` (o cualquier ruta bajo `(app)/`).
2. Esperado: redirect a `/login`.
3. Observado: el shell se renderiza igual, con datos vacíos/degradados en vez de redirigir.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
