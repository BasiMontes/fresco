# DEFECT: /notifications (Centro de Avisos) no contiene ningún aviso real, solo recomendaciones de recetas

**Jira Key:** [FRESCO-234](https://basiliomontescastano.atlassian.net/browse/FRESCO-234)
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Qué se observa

`/notifications` se titula "Centro de Avisos" / "Tus notificaciones", pero el único contenido real de la pantalla es una sección "Recetas que te pueden gustar" — un carrusel de recomendaciones de recetas, el mismo tipo de tarjeta que "Últimas recetas añadidas" de Inicio. No hay ningún aviso de sistema real (pago fallido, semana sin menú generado, etc.), pese a que ya existen eventos de ese tipo en el sistema (ej. el aviso de pago fallido de FRESCO-232, que hoy solo vive en `/profile`). Tampoco hay ningún contador o badge de "no leídos" en el icono de Notificaciones de la cabecera.

## Por qué importa

El nombre de la pantalla y del icono prometen algo (avisos/notificaciones reales) que el contenido no cumple — puede generar expectativa de que ahí aparecerán alertas importantes (pago, menú, etc.) cuando en realidad solo hay recomendaciones de recetas.

## Alcance

Esto es más una decisión de producto que un bug de código puntual — requiere decidir:

1. Si "Centro de Avisos" debe enrutar avisos reales del sistema (empezando por el de pago fallido, que ya existe como dato) además de o en vez de las recomendaciones de recetas.
2. Si el icono de la cabecera debería mostrar un badge cuando haya algo nuevo sin ver.

No se propone una implementación en este ticket — se documenta el gap encontrado en vivo para que el equipo decida el alcance.

## Cómo reproducir

1. Loguearse con cualquier cuenta.
2. Ir a `/notifications` (o tocar el icono de campana en la cabecera de `/menu`).
3. Observar que el único contenido es "Recetas que te pueden gustar", sin ningún aviso real.

## Evidencia

Encontrado en vivo con Playwright CLI contra staging (`fresco-pre.vercel.app`) durante el barrido QA sistemático del 2026-08-19. Ver `.context/qa/regression.feature` (nueva sección "Centro de Avisos (/notifications)").

---

## Metadata

- **Created:** 8/19/2026
- **Updated:** 8/20/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
