# Tarea: Revisar las 7 funciones SECURITY DEFINER ejecutables por anon/authenticated

**Jira Key:** [FRESCO-27](https://basiliomontescastano.atlassian.net/browse/FRESCO-27)
**Status:** Finalizada
**Type:** Tarea

---

## Description

Supabase advisors (security, 2026-08-01) marca 7 funciones SECURITY DEFINER callable vía /rest/v1/rpc/ por los roles anon y authenticated: get*filtered*recipes, get*recent*recipe*ids, handle*updated*at, jsonb*set*comprado, rls*auto*enable, swap*meal*plan*slots, update*recipe*learning. Revisar función por función si el acceso anon es intencional (modo invitado lo necesita para varias) o si hay que revocar EXECUTE / pasar a SECURITY INVOKER en las que no.

---

## Fields

### Clasificación

0|i0007r:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/1/2026
- **Updated:** 8/1/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
