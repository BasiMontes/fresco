# Comments for FRESCO-226

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-226)

---

### Basi Montes - 8/17/2026, 5:09:58 PM

## Acceptance Criteria

```gherkin
Scenario: Veo recomendaciones basadas en mis preferencias
  Given tengo preferencias dietéticas guardadas
  When entro al Centro de Avisos
  Then veo un aviso con recetas recomendadas que respetan mis restricciones

Scenario: Sin preferencias guardadas
  Given no tengo preferencias dietéticas guardadas
  When entro al Centro de Avisos
  Then no veo el aviso de recomendaciones

Scenario: Abro una receta recomendada
  Given veo el aviso de recetas recomendadas
  When toco una receta recomendada
  Then soy llevada al detalle de esa receta
```

---

### Basi Montes - 8/17/2026, 5:09:59 PM

## Scope

- Las recomendaciones respetan siempre las alergias y restricciones dietéticas declaradas
- El aviso muestra un número acotado de recetas recomendadas (ej. 3)

---

### Basi Montes - 8/17/2026, 5:10:00 PM

## Out Of Scope

- Recomendaciones basadas en el historial de recetas cocinadas o descartadas (posible mejora futura)
- Notificación push cuando aparecen nuevas recomendaciones

---

### Basi Montes - 8/17/2026, 5:10:01 PM

## Business Rules Specification

- Ninguna receta recomendada puede violar un alérgeno o restricción dietética declarada por la usuaria (misma garantía que EPIC-FRESCO-8, Seguridad Alimentaria)

---


_Synced from Jira by sync-jira-issues_
