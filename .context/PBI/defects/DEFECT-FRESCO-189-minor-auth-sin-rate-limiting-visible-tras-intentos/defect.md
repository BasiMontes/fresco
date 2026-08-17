# DEFECT: [MINOR] Auth: sin rate-limiting visible tras intentos de login fallidos repetidos

**Jira Key:** [FRESCO-189](https://basiliomontescastano.atlassian.net/browse/FRESCO-189)
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Qué se observa

***Severidad******:****** MINOR***

***Dónde***: `/login`

## Observado

5 intentos rápidos de login fallido contra la misma cuenta devolvieron el mismo 400 genérico sin ningún cooldown/lockout/captcha visible en la UI.

No confirmado como explotable (Supabase probablemente limita del lado servidor), pero nada se comunica al usuario ni sirve como señal de detección de ataque.

---

## Metadata

- **Created:** 8/11/2026
- **Updated:** 8/13/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
