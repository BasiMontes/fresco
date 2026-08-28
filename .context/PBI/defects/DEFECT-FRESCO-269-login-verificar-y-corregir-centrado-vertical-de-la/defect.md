# DEFECT: Login: verificar y corregir centrado vertical de la card

**Jira Key:** [FRESCO-269](https://basiliomontescastano.atlassian.net/browse/FRESCO-269)
**Priority:** Low
**Status:** Control de calidad
**Components:** None

---

## Description

## Contexto

Auditoría externa (Dojo, Ely, 14 ago 2026): en `/login`, la card queda con mucho aire arriba y abajo, sin centrarse del todo verticalmente, pese a que el contenedor usa `justify-center`.

Verificado en código el 26 ago 2026: `app/login/page.tsx` usa `mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12`, con el logo de Fresco por encima de la `Card` dentro del mismo bloque flex. Ese logo fue añadido por FRESCO-256 (posterior a la auditoría), pero para resolver un problema distinto: padding interno de la card, no el layout externo. Es plausible que el logo, al ocupar espacio por encima, desplace el centro visual de la card por debajo del centro real del viewport — pero no está confirmado sin mirarlo en vivo.

## Solución propuesta

No asumir el fix por código. Inspeccionar la pantalla en vivo (390px y escritorio) y medir con `getComputedStyle` el centro real de la card frente al centro del viewport antes de tocar nada. Si hay desvío perceptible, redistribuir el espacio del contenedor flex (por ejemplo, dar peso propio al bloque logo+card en vez de depender solo de `justify-center`) en lugar de mover elementos a ciegas.

## Plan de acción

1. Abrir `/login` en vivo (390px y escritorio) con Playwright o el navegador.
2. Medir el centro real de la card vs. el centro del viewport.
3. Si el desvío es real y perceptible: ajustar el layout del contenedor (`app/login/page.tsx`) para que la card quede centrada.
4. Si no hay desvío perceptible: cerrar el ticket como ya resuelto por FRESCO-256, con la medición como evidencia.

---

## Related Issues

- relates to: [FRESCO-81](https://basiliomontescastano.atlassian.net/browse/FRESCO-81) - Cuenta y Sesión
- relates to: [FRESCO-256](https://basiliomontescastano.atlassian.net/browse/FRESCO-256) - Auth (login/signup/recuperar contraseña/nueva contraseña): card sin padding, texto pegado arriba

---

## Metadata

- **Created:** 8/26/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-dojo

---

_Synced from Jira by sync-jira-issues_
