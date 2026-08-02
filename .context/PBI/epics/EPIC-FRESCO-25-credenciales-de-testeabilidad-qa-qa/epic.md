# EPIC: Credenciales de testeabilidad — QA (/qa)

**Jira Key:** [FRESCO-25](https://basiliomontescastano.atlassian.net/browse/FRESCO-25)
**Priority:** Medium
**Status:** Finalizada
**Total Story Points:** 0

---

## Description

## Credenciales reales de testing — Fresco

Esta épica es el destino de credenciales que enlaza la página pública `/qa` ("Guía de testeabilidad para QA"). Nunca borres esta épica sin actualizar esa página — es su único link de salida a valores reales.

### Cuentas demo

| Cuenta | Email | Password | Plan | Uso |
| --- | --- | --- | --- | --- |
| Local | `qa.fresco@local.test` | `FrescoQA2026!` | Free | Entorno local (`http://localhost:3000`) |
| PRE / staging | `qa-pre-verify-1785535816@fresco.qa` | `QaPre2026Test!` | Free | `https://fresco-pre.vercel.app` (mismo build que `fresco-pro.vercel.app`) |
| Pro dedicada | `qa-pro-test@fresco.qa` | `VvpZH#84winDuhcDNSQUA7bm` | Pro, con historial real | Para probar la tarjeta de aprendizaje (FRESCO-22 / ADR-0001) sin pisar las cuentas Free de arriba |

### Base de datos (Supabase)

- ***Project ref***: `jdqemhewjrjuopssdurn`
- ***URL***: `https://jdqemhewjrjuopssdurn.supabase.co`
- ***Anon / publishable key*** (RLS-enforced, el mismo que usa el cliente en producción — nunca la service role): `sb*publishable*RDZqSR8N9CRyvQ*dIuyT5g*YVRM6Yhd`
- ***Acceso vía MCP***: cualquier agente con este repo tiene el servidor `supabase` en `.mcp.json` ya configurado — `mcp_*supabase**execute*sql`, `list*tables`, `get*logs`, etc., contra este mismo project ref.
- ***Acceso humano***: Supabase Studio en `https://supabase.com/dashboard/project/jdqemhewjrjuopssdurn` (requiere ser miembro de la organización — pedir invite si hace falta).

### Edge Functions (API)

- ***Base URL***: `https://jdqemhewjrjuopssdurn.functions.supabase.co`
- Las 4 funciones reales: `generate-meal-plan`, `generate-shopping-list`, `reassign-guest-data`, `update-recipe-status`.
- Todas requieren `Authorization: Bearer <access*token>` — el token se obtiene logueando con cualquiera de las cuentas demo de arriba vía Supabase Auth (`supabase.auth.signInWithPassword`) y leyendo `session.access*token`.
- Contratos de request/response exactos: `api/schemas/api-contracts.types.ts` en el repo.

### .env de referencia (nombres + valores reales, para copiar/pegar en un entorno de testing propio)

```
NEXT*PUBLIC*SUPABASE_URL=https://jdqemhewjrjuopssdurn.supabase.co
NEXT*PUBLIC*SUPABASE*FUNCTIONS*URL=https://jdqemhewjrjuopssdurn.functions.supabase.co
SUPABASE*PUBLISHABLE*KEY=sb*publishable*RDZqSR8N9CRyvQ*dIuyT5g*YVRM6Yhd
LOCAL*USER*EMAIL=qa.fresco@local.test
LOCAL*USER*PASSWORD=FrescoQA2026!
USER*EMAIL*PRE=qa-pre-verify-1785535816@fresco.qa
USER*PASSWORD*PRE=QaPre2026Test!
PRO*TEST*USER_EMAIL=qa-pro-test@fresco.qa
PRO*TEST*USER_PASSWORD=VvpZH#84winDuhcDNSQUA7bm
```

> Nunca se incluye acá: `SUPABASE*SECRET*KEY` (service role), `GEMINI*API*KEY`, ni ninguna contraseña de base de datos a nivel superusuario — ninguna de esas hace falta para testear la app como usuario real.

### Ver también

Página pública: `/qa` en cualquiera de los dos entornos (local o PRE) — explica cómo usar todo esto (arquitectura, testing UI con Playwright, testing API con curl).

---

## Metadata

- **Created:** 8/1/2026
- **Updated:** 8/1/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
