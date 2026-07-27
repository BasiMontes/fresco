# Comments for FRESCO-11

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-11)

---

### Basi Montes - 7/27/2026, 7:29:34 PM

## Criterios de Aceptación

```gherkin
Scenario: Laura intercambia dos platos de su menú
  Given Laura tiene un menú semanal generado con los 21 espacios llenos
  When arrastra el plato del lunes cena al espacio de martes comida
  Then los platos de ambos espacios se intercambian
  And el nuevo orden se guarda inmediatamente sin necesidad de una acción adicional

Scenario: Laura recarga la página después de reordenar
  Given Laura reordenó su menú semanal arrastrando platos
  When vuelve a abrir el calendario más tarde
  Then ve el menú en el orden que dejó, no el orden original generado

Scenario: El intercambio falla por un error de red o de base de datos
  Given Laura intenta arrastrar un plato a otro espacio
  When el guardado del nuevo orden falla
  Then el plato vuelve visualmente a su posición original
  And ve un mensaje claro de que el cambio no se guardó
```


---

### Basi Montes - 7/27/2026, 7:29:35 PM

## Alcance

- Reordenar (intercambiar) dos platos del menú generado mediante arrastrar y soltar
- Persistir el nuevo orden en el mismo plan generado, sin crear un plan nuevo
- Reflejar el nuevo orden inmediatamente en la interfaz tras el arrastre
- Revertir visualmente el cambio si el guardado falla, mostrando un mensaje claro


---

### Basi Montes - 7/27/2026, 7:29:36 PM

## Fuera de Alcance

- Generar el menú semanal (propiedad de la historia de Generación de Menú)
- Marcar un plato como cocinado, descartado o sustituido (épico separado de Aprendizaje Cocinado/Descartado)
- Construir la lista de la compra a partir del menú (épico separado de Lista de la Compra)
- Añadir o eliminar espacios del menú (el menú siempre tiene exactamente 21 espacios fijos, por regla de negocio de Generación de Menú)


---

### Basi Montes - 7/27/2026, 7:29:38 PM

## Especificación de Reglas de Negocio

- Cada espacio del menú (día × tipo de plato) solo puede contener una receta a la vez — intercambiar dos platos nunca debe dejar un espacio vacío ni duplicado
- El intercambio de posición nunca cambia el estado de aprendizaje (cocinado/descartado) de ninguna receta — es una operación neutral sobre ese estado
- Un menú siempre mantiene exactamente 21 espacios; el reordenamiento nunca añade, elimina, ni genera espacios nuevos


---


_Synced from Jira by sync-jira-issues_
