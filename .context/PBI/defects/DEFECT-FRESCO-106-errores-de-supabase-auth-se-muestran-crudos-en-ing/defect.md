# DEFECT: Errores de Supabase Auth se muestran crudos en inglés en login/signup

**Jira Key:** [FRESCO-106](https://basiliomontescastano.atlassian.net/browse/FRESCO-106)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

Este bug fue encontrado de forma ***independiente por 2 pases de QA distintos*** (uno cubriendo Onboarding/Menú/Calendario, otro cubriendo Auth/Perfil/Legal), lo que confirma que es sistémico y no un caso aislado.

- ***Dónde***: `/login` (`login*error*message`) y `/signup` (`signup*error*message`) — patrón `setError(error.message)` sin traducir, en `app/login/page.tsx` y `app/signup/page.tsx`.
- El mensaje crudo de Supabase se muestra literal en inglés:
- El resto de la UI (labels, placeholders, botones, mensajes de éxito) está 100% en español, así que este mensaje desentona fuertemente y puede confundir a usuarios no angloparlantes.
- ***Nota relacionada (mismo hallazgo, mayor severidad puntual)***: en un intento de login se disparó un error real de CORS/rate-limit de Supabase (`Access to fetch ... has been blocked by CORS policy`) tras varios intentos fallidos seguidos en poco tiempo, y ese fallo de red también terminó mostrado crudo como `"Failed to fetch"` — el mismo `catch`/`error.message` sin manejo de errores de red aparte de los de credenciales.
- ***Evidencia***: snapshot de accesibilidad capturado con el texto exacto en ambos casos; confirmado con dos escenarios independientes (login y signup), mismo patrón de código (`error.message` sin mapa de traducción).

## Por qué importa

El problema no es solo falta de traducción del caso de credenciales inválidas: es falta de un mensaje de fallback genérico y amigable para **cualquier** error no controlado (red, rate-limit, CORS, etc.). Al haber sido detectado de forma independiente en dos flujos distintos (login y signup) por dos QA distintos, confirma que el patrón `error.message` sin traducir está replicado en todo el módulo de Auth.

## Alcance

Agregar una capa de traducción de errores comunes de Supabase Auth (credenciales inválidas, password corta, etc.) a español, ***más*** un mensaje de fallback genérico y amigable para cualquier error no mapeado (red, rate-limit, CORS) — no solo traducir el caso de credenciales.

## Cómo reproducir

1. Ir a `/login`, ingresar un email válido con password incorrecta/inexistente → submit. Observar `"Invalid login credentials"` en inglés.
2. Ir a `/signup`, marcar checkbox de términos, poner password de 1-3 caracteres → submit. Observar `"Password should be at least 6 characters."` en inglés.
3. (Caso adicional de red) Disparar varios intentos fallidos de login seguidos en poco tiempo → puede aparecer `"Failed to fetch"` crudo por un error de CORS/rate-limit de Supabase.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
