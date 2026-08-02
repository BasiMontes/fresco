# Comments for FRESCO-59

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-59)

---

### Basi Montes - 8/2/2026, 9:30:28 PM

## Scope

- Sección en Inicio con cards de las recetas agregadas más recientemente al catálogo
- Botón "Ver todas" que lleva a la pantalla de Recetas

---

### Basi Montes - 8/2/2026, 9:30:29 PM

## Out Of Scope

- Cualquier forma de ordenar o filtrar esta sección más allá de "más recientes primero"

---

### Basi Montes - 8/2/2026, 9:30:30 PM

## Acceptance Criteria

```gherkin
Scenario: Ver las últimas recetas
Given Laura abre Inicio
When mira la sección de últimas recetas
Then ve las recetas agregadas más recientemente al catálogo, dentro de las que puede comer según su perfil

Scenario: Ver todas las recetas
Given Laura ve la sección de últimas recetas
When toca "Ver todas"
Then es llevada a la pantalla de Recetas
```

---


_Synced from Jira by sync-jira-issues_
