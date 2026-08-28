# Tarea: Implementar guest-mode anónimo per ADR-0003

**Jira Key:** [FRESCO-38](https://basiliomontescastano.atlassian.net/browse/FRESCO-38)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de deuda técnica de sesión — 4 comentarios TODO marcados como 'sin resolver' pero la decisión técnica ya está tomada y verificada en vivo.

***Qué:*** `ADR-0003-guest-auth-anonymous-sign-in.md` (aceptada 2026-07-31) ya decidió y verificó en vivo el mecanismo: `supabase.auth.signInAnonymously()`. Confirmado contra el proyecto real: sesión anónima real con JWT válido, `auth.uid()` real, cero cambios necesarios en Edge Functions ni políticas RLS (todo ya scoped a `auth.uid()`).

***TODOs a resolver con esta implementación:***
- `app/(app)/menu/page.tsx:44`
- `lib/api/user-profile.ts:44`
- `lib/api/edge-functions.ts:73`
- `supabase/functions/_shared/auth.ts:9`

***Riesgo ya documentado (no bloqueante para esta tarea, pero a tener en cuenta para EPIC-FRESCO-7 Progressive Signup):*** el upgrade de cuenta anónima a permanente vía `updateUser({ email })` requiere verificación de email — este proyecto ya mostró en vivo rate-limiting agresivo del mailer gratuito de Supabase para eso.

***Severidad:*** desbloquea Master Sprint 2 (EPIC-FRESCO-6 Guest Mode) — esfuerzo medio, mecanismo ya validado, no exploratorio.

---

## Fields

### Clasificación

0|i000a7:

### customfield_10000

{repository={count=1, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":1,"lastUpdated":"2026-08-02T01:05:22.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":1,"name":"GitHub"},"GitHub":{"count":1,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/1/2026
- **Updated:** 8/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
