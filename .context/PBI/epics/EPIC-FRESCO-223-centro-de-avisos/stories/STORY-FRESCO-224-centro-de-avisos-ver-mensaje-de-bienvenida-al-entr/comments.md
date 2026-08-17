# Comments for FRESCO-224

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-224)

---

### Basi Montes - 8/17/2026, 5:08:21 PM

## Acceptance Criteria

```gherkin
Scenario: Primera visita muestra bienvenida
  Given soy una usuaria que acaba de completar el onboarding
  When entro al Centro de Avisos por primera vez
  Then veo un aviso de bienvenida que me explica qué puedo hacer en la app

Scenario: La bienvenida no vuelve a aparecer
  Given ya vi el aviso de bienvenida antes
  When vuelvo a entrar al Centro de Avisos
  Then no veo el aviso de bienvenida de nuevo

Scenario: Usuaria sin onboarding completo
  Given no he completado el onboarding
  When entro al Centro de Avisos
  Then no veo el aviso de bienvenida todavía
```

---

### Basi Montes - 8/17/2026, 5:08:22 PM

## Scope

- Aviso de bienvenida único, mostrado la primera vez que entro al Centro de Avisos tras completar el onboarding
- El aviso queda marcado como visto y no vuelve a aparecer, aunque cambie de dispositivo

---

### Basi Montes - 8/17/2026, 5:08:23 PM

## Out Of Scope

- Notificaciones push o email de bienvenida
- Personalización del contenido de bienvenida por segmento de usuaria

---


_Synced from Jira by sync-jira-issues_
