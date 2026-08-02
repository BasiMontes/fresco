# Comments for FRESCO-57

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-57)

---

### Basi Montes - 8/2/2026, 9:30:20 PM

## Scope

- Card con el número total de recetas disponibles para el perfil del usuario (ya excluidas las que no puede comer)
- Al tocar la card, se abre la pantalla de Recetas

---

### Basi Montes - 8/2/2026, 9:30:21 PM

## Out Of Scope

- Filtros o búsqueda dentro de esta card

---

### Basi Montes - 8/2/2026, 9:30:22 PM

## Acceptance Criteria

```gherkin
Scenario: Ver el total de recetas disponibles
Given Laura tiene alérgenos e ingredientes marcados en su perfil
When abre Inicio
Then ve el número de recetas disponibles que respetan esas restricciones

Scenario: Entrar al catálogo desde la card
Given Laura ve la card de recetas disponibles
When toca la card
Then es llevada a la pantalla de Recetas
```

---


_Synced from Jira by sync-jira-issues_
