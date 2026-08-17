# DEFECT: Auth: login/signup/forgot-password sin <title> propio

**Jira Key:** [FRESCO-174](https://basiliomontescastano.atlassian.net/browse/FRESCO-174)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx` — ninguna define `metadata`/`<title>` propio, heredan el título de la landing.
- Hallazgo del QA sweep (agente Auth+Landing, MINOR): la pestaña del navegador dice "Fresco — Menús semanales..." en las 3 páginas en vez de algo como "Inicia sesión · Fresco".

## Cambio propuesto

- Agregar `export const metadata` con un `title` propio a cada una de las 3 páginas, siguiendo la convención estándar de metadata por-ruta de Next.js.

## Alcance

- Solo las 3 páginas listadas.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
