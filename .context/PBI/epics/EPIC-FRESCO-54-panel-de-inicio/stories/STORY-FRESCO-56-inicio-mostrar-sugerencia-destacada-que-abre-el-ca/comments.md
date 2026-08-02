# Comments for FRESCO-56

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-56)

---

### Basi Montes - 8/2/2026, 9:30:16 PM

## Scope

- Banner destacado en la parte superior de Inicio con un mensaje corto
- Botón que lleva directo al Calendario de la semana

---

### Basi Montes - 8/2/2026, 9:30:17 PM

## Out Of Scope

- Generación dinámica del mensaje por IA en tiempo real (ver Business Rules — texto fijo en esta versión)

---

### Basi Montes - 8/2/2026, 9:30:18 PM

## Acceptance Criteria

```gherkin
Scenario: Abrir el plan desde la sugerencia
Given Laura está en Inicio y ve el banner de sugerencia
When toca el botón de ver el plan
Then es llevada directamente al Calendario de su semana

Scenario: El banner siempre está visible
Given Laura entra a Inicio
When la pantalla carga
Then el banner de sugerencia se muestra, sin importar si ya generó su menú antes o es la primera vez que entra
```

---

### Basi Montes - 8/2/2026, 9:30:19 PM

## Business Rules Specification

- El mensaje del banner es texto predefinido para esta versión; no se genera dinámicamente a partir del historial o el menú del usuario.

---


_Synced from Jira by sync-jira-issues_
