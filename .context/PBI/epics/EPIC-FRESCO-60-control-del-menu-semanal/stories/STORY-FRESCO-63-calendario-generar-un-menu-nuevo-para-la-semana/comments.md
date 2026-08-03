# Comments for FRESCO-63

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-63)

---

### Basi Montes - 8/3/2026, 1:50:57 PM

## Scope

- Un control "Generar" que pide un menú nuevo para la semana que Laura está viendo en ese momento, no solo la primera generación de onboarding
- Las mismas garantías de seguridad alimentaria, presupuesto y variedad que ya aplican a la generación original

---

### Basi Montes - 8/3/2026, 1:50:58 PM

## Out Of Scope

- Generar sobre una semana que ya tiene un menú sin eliminarlo primero — hay que usar la acción de eliminar de la historia hermana antes
- Elegir un comportamiento de IA distinto o personalizar la generación más allá del perfil ya capturado en onboarding

---

### Basi Montes - 8/3/2026, 1:50:59 PM

## Acceptance Criteria

```gherkin
Scenario: Generar para una semana vacía
Given Laura está viendo una semana sin menú generado todavía
When toca "Generar"
Then recibe un menú semanal completo para esa semana, con las mismas garantías de seguridad alimentaria que la generación original

Scenario: No se puede generar sobre una semana que ya tiene menú
Given Laura está viendo una semana que ya tiene un menú generado
When mira los controles disponibles
Then no puede generar uno nuevo directamente — primero tiene que eliminar el existente

Scenario: La generación falla
Given Laura pidió generar un menú nuevo para la semana que está viendo
When el sistema no puede completar la generación
Then ve un mensaje de error claro y la semana permanece sin menú, tal como estaba antes de intentarlo
```

---

### Basi Montes - 8/3/2026, 1:51:01 PM

## Business Rules Specification

- Nunca puede haber más de un menú generado por semana — generar exige que la semana esté vacía (recién limpiada, o nunca usada).
- La generación para cualquier semana respeta las mismas reglas duras de seguridad alimentaria, presupuesto y variedad que ya aplican a la generación original.

---


_Synced from Jira by sync-jira-issues_
