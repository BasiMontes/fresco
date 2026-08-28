# EPIC: Motion y Transiciones

**Jira Key:** [FRESCO-244](https://basiliomontescastano.atlassian.net/browse/FRESCO-244)
**Priority:** Medium
**Status:** Listo
**Total Story Points:** 0

---

## Description

## Descripción

La app funciona pero carece de movimiento: las pantallas cambian de golpe, las listas
aparecen y desaparecen sin transición, y las acciones no dan feedback visual inmediato.
Esta épica introduce un sistema de motion coherente aplicado a un conjunto acotado de
superficies clave — transiciones entre rutas principales, listas y tarjetas, modales y
paneles, y feedback en botones — para que la app se sienta más viva y confiable sin caer
en decoración gratuita.

Para Laura, que ya de por sí quiere resolver la planificación semanal con el mínimo
esfuerzo mental, un movimiento suave y predecible reduce la sensación de "salto" al
navegar y le da confianza inmediata de que sus acciones (marcar un plato como cocinado,
dar like a una receta, guardar cambios) se registraron, sin tener que verificarlo dos
veces.

Toda animación introducida por esta épica respeta la preferencia de movimiento reducido
del sistema del usuario (historia dedicada, ver más abajo).

## Definition of done

- [ ] Las 5 historias de esta épica están completas y validadas
- [ ] Ninguna transición introducida ignora la preferencia de movimiento reducido
- [ ] QA validó las superficies cubiertas en staging

---

## User Stories

| Key | Story | Points | Priority | Status |
| --- | ----- | ------ | -------- | ------ |
| [FRESCO-245](https://basiliomontescastano.atlassian.net/browse/FRESCO-245) | Transiciones de Página | Transicionar suavemente entre rutas principales al navegar | - | Medium | Control de calidad |
| [FRESCO-246](https://basiliomontescastano.atlassian.net/browse/FRESCO-246) | Listas y Tarjetas | Animar entrada y salida de tarjetas en listas y calendario | - | Medium | Control de calidad |
| [FRESCO-247](https://basiliomontescastano.atlassian.net/browse/FRESCO-247) | Modales | Transicionar apertura y cierre de modales | - | Medium | Control de calidad |
| [FRESCO-248](https://basiliomontescastano.atlassian.net/browse/FRESCO-248) | Micro-interacciones | Dar feedback visual inmediato en botones y acciones de guardado | - | Medium | Finalizada |
| [FRESCO-249](https://basiliomontescastano.atlassian.net/browse/FRESCO-249) | Accesibilidad de Movimiento | Respetar la preferencia de movimiento reducido del sistema | - | Medium | Control de calidad |

---

## Metadata

- **Created:** 8/21/2026
- **Updated:** 8/21/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** implementation-plan-ready, new-feature, post-mvp

---

_Synced from Jira by sync-jira-issues_
