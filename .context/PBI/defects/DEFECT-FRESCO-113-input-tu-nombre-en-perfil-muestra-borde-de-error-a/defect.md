# DEFECT: Input "Tu nombre" en Perfil muestra borde de error antes de que el usuario lo toque

**Jira Key:** [FRESCO-113](https://basiliomontescastano.atlassian.net/browse/FRESCO-113)
**Priority:** Medium
**Status:** WIP
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `/profile` → tarjeta "Tu nombre", `components/profile/nombre-form.tsx`, input `data-testid="nombre_input"`
- ***Pasos para reproducir***: iniciar sesión con una cuenta sin `nombre` guardado (ej. `qa-pro-test@fresco.qa`) → ir a `/profile`.
- ***Esperado***: el propio comentario del código documenta la intención explícita de que el campo sea "silent on first paint" (igual que el patrón de `household` en onboarding) — sin ningún indicio de error hasta que el usuario interactúe. El mensaje de validación (`nombre*validation*message`) sí respeta esto correctamente, gateado por `touched`.
- ***Observado***: la clase CSS del input (`className={!isValid ? 'border-error' : ''}`) ignora el gate de `touched` que sí aplica el mensaje de texto — así que el borde rojo/error aparece inmediatamente al cargar la página (campo vacío = `!isValid`), sin ningún mensaje visible que lo explique. Visualmente parece un error de validación disparado sin que el usuario haya hecho nada.
- ***Evidencia***: capturas de pantalla en 375px y 1280px, ambas muestran el input con borde rojo (`border-color: rgb(184, 66, 46)`, clase `border-error` presente vía `getComputedStyle`) en el primer render, sin mensaje de error acompañante.

## Por qué importa

Contradice el propio patrón "silent on first paint" documentado en el código y puede generar confusión/desconfianza al primer vistazo del perfil. No bloquea el guardado (basta con escribir un nombre).

## Alcance

Gatear también la clase `border-error` por `touched`, igual que ya hace el mensaje de validación (`nombre*validation*message`).

## Cómo reproducir

1. Iniciar sesión con una cuenta sin nombre guardado (ej. `qa-pro-test@fresco.qa`).
2. Ir a `/profile`.
3. Observar el borde del input "Tu nombre" en el primer render, sin haberlo tocado.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/7/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
