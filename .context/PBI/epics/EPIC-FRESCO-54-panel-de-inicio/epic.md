# EPIC: Panel de Inicio

**Jira Key:** [FRESCO-54](https://basiliomontescastano.atlassian.net/browse/FRESCO-54)
**Priority:** Medium
**Status:** Finalizada
**Total Story Points:** 0

---

## Description

Rediseña la pantalla actual de Inicio (`/menu` — hoy centrada solo en las comidas del día) para convertirla en un panel más completo: saludo personalizado, acceso rápido al plan semanal, una foto del valor que Fresco le está dando al usuario (recetas disponibles, ahorro estimado) y descubrimiento de recetas nuevas — todo antes de tener que navegar a otra pantalla.

***Business Value******:***
El usuario abre la app y en un vistazo entiende "qué tengo esta semana" y "cuánto me está sirviendo esto" — refuerza el hábito de uso semanal (el KPI norte de Fresco: menús generados y usados) sin fricción de navegación extra.

***Nota / asunción a confirmar con el founder******:*** la sección de últimas recetas añadidas respeta el mismo filtro de seguridad alimentaria (alérgenos/dieta) que ya aplica al resto del catálogo — no debería mostrar recetas fuera del perfil del usuario. Si esto no es correcto, ajustar el AC de la historia correspondiente antes de pasar a desarrollo.

***Master Sprint******:*** No aplica — los Master Sprint 0-2 (las 8 épicas MVP originales) ya están cerrados (Finalizada/Listo en el epic-tree). Esta es una iniciativa incremental post-MVP, fuera de ese roadmap.

## Acceptance Criteria (Epic Level)

1. El usuario ve un panel de Inicio con saludo personalizado, acceso directo al plan semanal, indicadores de valor (recetas disponibles + estimaciones de ahorro) y descubrimiento de recetas nuevas, sin salir de la pantalla.
2. Los 5 historias hijas de esta épica están todas en estado Done.
3. La pantalla sigue siendo la misma ruta que hoy usa el usuario para ver "Inicio" en la navegación — no se agrega ni se quita ningún ítem del menú de navegación.

---

## User Stories

| Key | Story | Points | Priority | Status |
| --- | ----- | ------ | -------- | ------ |
| [FRESCO-55](https://basiliomontescastano.atlassian.net/browse/FRESCO-55) | Inicio | Saludar al usuario por su nombre | - | Medium | Finalizada |
| [FRESCO-56](https://basiliomontescastano.atlassian.net/browse/FRESCO-56) | Inicio | Mostrar sugerencia destacada que abre el Calendario | - | Medium | Finalizada |
| [FRESCO-57](https://basiliomontescastano.atlassian.net/browse/FRESCO-57) | Inicio | Mostrar cantidad de recetas disponibles | - | Medium | Finalizada |
| [FRESCO-58](https://basiliomontescastano.atlassian.net/browse/FRESCO-58) | Inicio | Mostrar estimaciones de ahorro semanal | - | Medium | Finalizada |
| [FRESCO-59](https://basiliomontescastano.atlassian.net/browse/FRESCO-59) | Inicio | Mostrar últimas recetas añadidas | - | Medium | Finalizada |

---

## Metadata

- **Created:** 8/2/2026
- **Updated:** 8/3/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** new-feature, post-mvp

---

_Synced from Jira by sync-jira-issues_
