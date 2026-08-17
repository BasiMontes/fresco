# Comments for FRESCO-225

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-225)

---

### Basi Montes - 8/17/2026, 5:09:34 PM

## Acceptance Criteria

```gherkin
Scenario: Veo el aviso de rutas principales
  Given entro al Centro de Avisos
  When el aviso de rutas principales está disponible
  Then veo un aviso con enlaces a Menú, Calendario y Lista de la Compra

Scenario: Sigo un enlace del aviso
  Given veo el aviso de rutas principales
  When toco uno de los enlaces
  Then soy llevada a esa sección de la app

Scenario: Descarto el aviso
  Given veo el aviso de rutas principales
  When elijo descartarlo
  Then el aviso desaparece y no vuelve a aparecer
```

---

### Basi Montes - 8/17/2026, 5:09:35 PM

## Scope

- Aviso estático con enlaces a Menú, Calendario y Lista de la Compra
- Descartable; no reaparece una vez descartado

---

### Basi Montes - 8/17/2026, 5:09:37 PM

## Out Of Scope

- Recorrido interactivo guiado paso a paso sobre cada pantalla (tour animado); esto es solo un aviso con enlaces, no un tutorial interactivo
- Enlaces personalizados según el uso real de la usuaria

---


_Synced from Jira by sync-jira-issues_
