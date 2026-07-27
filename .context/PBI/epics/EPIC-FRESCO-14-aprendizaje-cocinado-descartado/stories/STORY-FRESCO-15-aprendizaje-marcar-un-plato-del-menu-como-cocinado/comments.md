# Comments for FRESCO-15

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-15)

---

### Basi Montes - 7/27/2026, 7:30:39 PM

## Criterios de Aceptación

```gherkin
Scenario: Laura marca un plato como cocinado
  Given Laura tiene un menú semanal generado con un plato en estado pendiente
  When marca ese plato como cocinado
  Then el plato se muestra como cocinado
  And no puede volver a cambiar el estado de ese mismo plato

Scenario: Laura marca un plato como descartado
  Given Laura tiene un menú semanal generado con un plato en estado pendiente
  When marca ese plato como descartado
  Then el plato se muestra como descartado
  And no puede volver a cambiar el estado de ese mismo plato

Scenario: Laura intenta cambiar el estado de un plato ya marcado
  Given Laura ya marcó un plato como cocinado o descartado
  When intenta marcar ese mismo plato de nuevo
  Then no puede hacerlo
  And ve que ese plato quedó fijado en su estado actual

Scenario: Laura es usuaria Free y marca varios platos durante varias semanas
  Given Laura es usuaria del nivel gratuito y ha marcado varios platos como cocinados o descartados
  When recibe su menú de la semana siguiente
  Then ve una indicación clara de que este registro es una función de nivel Pro y que su menú actual no se ha visto influido por él
```


---

### Basi Montes - 7/27/2026, 7:30:40 PM

## Alcance

- Marcar cualquier plato pendiente del menú semanal generado como cocinado o como descartado
- Bloquear el cambio de estado una vez que un plato ya está marcado como cocinado o descartado
- Mostrar visualmente el estado actual de cada plato (pendiente, cocinado, descartado)
- Comunicar de forma clara a las usuarias del nivel gratuito que este registro es una capacidad de nivel Pro cuando se aplica a la generación futura


---

### Basi Montes - 7/27/2026, 7:30:42 PM

## Fuera de Alcance

- Generar el menú semanal del que parten los platos a marcar (propiedad de la historia de Generación de Menú)
- Aplicar el historial de cocinado/descartado a la generación de menús futuros (capacidad exclusiva de Pro, historia separada, gateada por al menos dos semanas de historial real)
- Sustituir un plato por otra receta (estado "sustituida" — historia separada)
- Puntuar con estrellas o calificar un plato cocinado (fuera del alcance de esta historia fundacional)


---

### Basi Montes - 7/27/2026, 7:30:43 PM

## Especificación de Reglas de Negocio

- Una vez marcado como cocinado o descartado, un plato queda fijado — es un estado terminal que no puede volver a cambiarse
- El registro de cocinado/descartado ocurre igual para toda usuaria, sin importar su nivel — lo que difiere entre niveles es si ese historial influye en la generación futura, nunca si se registra o no
- Marcar un plato nunca cambia el menú de la semana actual — solo puede influir, cuando corresponda, en generaciones futuras


---


_Synced from Jira by sync-jira-issues_
