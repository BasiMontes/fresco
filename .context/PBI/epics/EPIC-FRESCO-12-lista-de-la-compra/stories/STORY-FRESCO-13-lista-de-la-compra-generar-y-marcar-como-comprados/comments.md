# Comments for FRESCO-13

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-13)

---

### Basi Montes - 7/27/2026, 7:30:06 PM

## Criterios de Aceptación

```gherkin
Scenario: Laura genera la lista de la compra de su menú semanal
  Given Laura tiene un menú semanal generado
  When solicita la lista de la compra de ese menú
  Then ve todos los ingredientes de las 21 comidas consolidados y agrupados por pasillo

Scenario: Laura marca un producto como comprado
  Given Laura tiene una lista de la compra generada
  When marca un producto como comprado
  Then el producto se muestra visualmente como comprado
  And el estado se conserva la próxima vez que abre la lista

Scenario: Laura ya tiene una lista de la compra para ese menú
  Given Laura ya generó una lista de la compra para su menú semanal actual
  When intenta generar la lista de nuevo
  Then ve la lista ya existente en lugar de una segunda lista duplicada

Scenario: La consolidación de ingredientes no produce ningún resultado
  Given el menú semanal de Laura no tiene ingredientes que se puedan consolidar
  When solicita la lista de la compra
  Then ve un mensaje claro de que la lista no se pudo generar, nunca una lista vacía presentada como válida
```


---

### Basi Montes - 7/27/2026, 7:30:07 PM

## Alcance

- Generar la lista de la compra a partir del menú semanal ya generado, consolidando ingredientes repetidos entre las 21 comidas
- Agrupar los productos por pasillo del supermercado
- Marcar y desmarcar cada producto como comprado, conservando ese estado entre visitas
- Mostrar un resumen del total de productos y el coste estimado de la compra
- Mostrar un mensaje claro cuando la lista no se pueda generar


---

### Basi Montes - 7/27/2026, 7:30:08 PM

## Fuera de Alcance

- Generar el menú semanal del que parte la lista (propiedad de la historia de Generación de Menú)
- Reordenar o editar el menú semanal (épico de Calendario Editable)
- Comparación de precios entre supermercados o escaneo de recibos (fuera del alcance del MVP)
- Gestión de inventario o despensa (fuera del alcance del MVP)


---

### Basi Montes - 7/27/2026, 7:30:09 PM

## Especificación de Reglas de Negocio

- Solo puede existir una lista de la compra por menú semanal — nunca se genera una segunda lista duplicada para el mismo menú
- El coste estimado siempre se presenta como una estimación, nunca como un precio exacto o garantizado
- Marcar un producto como comprado es una acción local del hogar y no afecta ni al menú ni a ningún dato de aprendizaje


---


_Synced from Jira by sync-jira-issues_
