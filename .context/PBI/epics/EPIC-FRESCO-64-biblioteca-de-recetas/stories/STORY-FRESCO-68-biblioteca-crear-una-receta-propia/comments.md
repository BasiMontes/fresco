# Comments for FRESCO-68

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-68)

---

### Basi Montes - 8/3/2026, 2:46:43 PM

## Scope

- Formulario para que Laura cargue una receta propia (nombre, ingredientes, pasos) a su biblioteca personal
- Sus recetas propias se ven junto al catálogo en la Biblioteca, distinguibles de las del catálogo

---

### Basi Montes - 8/3/2026, 2:46:44 PM

## Out Of Scope

- La receta propia participa en la generación de menú semanal por IA (confirmado explícitamente con el user: queda fuera)
- Compartir la receta propia con otras usuarias
- Foto o imagen para la receta propia
- Editar o eliminar una receta propia ya creada

---

### Basi Montes - 8/3/2026, 2:46:46 PM

## Acceptance Criteria

```gherkin
Scenario: Crear una receta propia
Given Laura está en la Biblioteca
When completa el formulario "Crear propia" con nombre, ingredientes y pasos, y confirma
Then su receta aparece en su Biblioteca personal

Scenario: Receta propia no participa en la generación
Given Laura tiene una receta propia guardada
When genera un menú semanal nuevo
Then esa receta propia nunca aparece en el menú generado por la IA

Scenario: Campos obligatorios
Given Laura abre el formulario de "Crear propia" sin completar el nombre
When intenta guardar
Then ve un mensaje claro pidiéndole completar el nombre antes de guardar
```

---

### Basi Montes - 8/3/2026, 2:46:47 PM

## Business Rules Specification

- Una receta propia es visible únicamente para la usuaria que la creó.
- Una receta propia no participa en la generación de menú semanal por IA — distinto del catálogo, confirmado explícitamente con el user.

---


_Synced from Jira by sync-jira-issues_
