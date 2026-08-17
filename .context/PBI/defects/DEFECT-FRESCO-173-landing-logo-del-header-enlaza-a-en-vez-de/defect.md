# DEFECT: Landing: logo del header enlaza a # en vez de /

**Jira Key:** [FRESCO-173](https://basiliomontescastano.atlassian.net/browse/FRESCO-173)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/landing/site-nav.tsx` — el logo "Fresco" del header enlaza a `href="#"`.
- Hallazgo del QA sweep (agente Auth+Landing, MINOR): en `/` es un no-op (ya está en el top), pero si el patrón se reutiliza en otra página solo saltaría al top, no navegaría al inicio real.

## Cambio propuesto

- Cambiar el `href` del logo a `/`.

## Alcance

- Solo esa línea en `site-nav.tsx`.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
