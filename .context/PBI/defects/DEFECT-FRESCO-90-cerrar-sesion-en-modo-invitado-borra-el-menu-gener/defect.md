# DEFECT: "Cerrar sesión" en modo invitado borra el menú generado sin ninguna advertencia

**Jira Key:** [FRESCO-90](https://basiliomontescastano.atlassian.net/browse/FRESCO-90)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

***Dónde***: `components/layout/sidebar-account.tsx` (`sidebar*logout*button`), visible en el sidebar de escritorio de cualquier página de `(app)/`

***Pasos para reproducir***:

1. Entrar sin login, generar un menú como invitada.
2. En el sidebar (desktop, 1280px), click en el ícono de logout ("Cerrar sesión").
3. Ir de nuevo a `/menu`.

***Esperado***: dado que en modo invitado el logout es funcionalmente un "borrar todo mi progreso", debería haber alguna advertencia específica ("perderás tu menú, ¿seguro?") distinta del logout normal de una cuenta registrada (donde es 100% seguro).

***Observado***: el mismo botón, mismo comportamiento, cero diferenciación — redirige a `/login` sin avisos, y el menú generado (dato real, persistido en `meal_plans`) queda inaccesible: `/menu` vuelve a mostrar "Todavía no tienes un menú para esta semana".

***Evidencia***: verificado con eval directo del DOM antes/después del click; sesión anónima invalidada, `getMealPlanForWeek` etc. fallan server-side con "No hay una sesión autenticada" (logueado en consola, manejado con gracia hacia un estado vacío, pero el dato ya no es accesible).

## Por qué importa

Es el mismo botón y el mismo copy que el logout de una cuenta real (donde es 100% seguro y reversible) — para una invitada es, en la práctica, un borrado irreversible de datos reales (`meal_plans`), sin ninguna señal de que es distinto.

## Alcance

1. Diferenciar el copy/confirmación del botón de logout cuando la sesión es anónima (`user.is_anonymous`) vs una cuenta real.
2. Agregar un diálogo de confirmación específico para el caso invitada ("vas a perder tu menú generado, ¿seguro?").

## Cómo reproducir

1. Entrar sin login, generar un menú como invitada.
2. En el sidebar (desktop, 1280px), click en el ícono de logout ("Cerrar sesión").
3. Ir de nuevo a `/menu`.
4. Se muestra "Todavía no tienes un menú para esta semana" — el menú generado quedó inaccesible sin ninguna advertencia previa.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
