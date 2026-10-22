# Kit de lanzamiento: textos y capturas

> Ticket: FRESCO-889 (epic FRESCO-884). Texto reutilizable para fichas de directorios, publicaciones y comunidades.
> Todos los datos salen de la landing, de `metadata.description` y del FAQ ya aprobado. Si cambia un plan, un precio o una función, se actualiza aquí en el mismo cambio.
> El precio no lleva cifra a propósito: el importe sale de Stripe y se ve antes de confirmar.

## Descripción corta

Fresco genera tu menú semanal y tu lista de la compra en menos de 30 segundos. Con filtros de alergias y dieta, y gratis para empezar.

## Descripción larga

Fresco es un planificador de menús semanales. Le cuentas tu dieta, tus alergias, cuántos sois en casa y cuánto quieres gastar, y en menos de 30 segundos tienes el menú de lunes a domingo y la lista de la compra ordenada por pasillos, con las cantidades ajustadas a tu hogar.

Los filtros de alergias y de dieta se aplican antes de generar nada: un alérgeno declarado no entra en tu menú. Puedes cambiar cualquier receta con un toque y regenerar solo ese hueco, sin tocar el resto de la semana.

El plan Free es gratis para siempre y no pide tarjeta. El plan Pro tiene 7 días de prueba y añade el aprendizaje: Fresco aprende de lo que cocinas y descartas, no repite lo que cocinaste hace poco y te explica por qué eligió cada receta. Se cancela cuando quieras desde el perfil.

Lo que no hace todavía: no hace el pedido en el supermercado por ti. La lista incluye enlaces y precios orientativos de algunas cadenas, que pueden haber cambiado.

## Primer comentario del autor

Hola. Soy quien ha hecho Fresco y os cuento por qué.

El problema de fondo es el tiempo. Llegas a casa, abres la nevera y no tienes ni idea de qué comer. Y entre lo que improvisas, lo que se estropea y las tres vueltas al súper de la semana, se va dinero y se tira comida.

Lo que yo quería era tener organizado de antemano qué voy a comer: el lunes puchero y hamburguesas, el martes pasta y sopa, y así toda la semana. Y que además me saliera la lista de la compra de ese menú, para ir una vez y comprar lo que toca.

Eso es Fresco: te genera el menú semanal y la lista de la compra en menos de 30 segundos, respetando tu dieta y tus alergias. Es gratis para empezar y no pide tarjeta.

Acaba de salir, así que me ayuda mucho que lo probéis y me contéis qué os falta o qué no funciona. Os leo y respondo a todos.

## Capturas

Cinco capturas de 1184 x 740 px, tomadas de la app real, sin correo. Las dos últimas (22-10-2026) son de una cuenta de pruebas con plan Pro y se ocultó su tarjeta de cuenta; el saludo de `04` dice «Pro Pre», el nombre de esa cuenta de pruebas, no un dato personal.

| Fichero | Pantalla | Qué enseña | Texto alternativo |
|---|---|---|---|
| `screenshots/01-menu-semanal.png` | Menú | Desayuno, comida y cena del día, recetas disponibles y gasto semanal estimado | Pantalla de menú de Fresco con las tres comidas del día y el gasto semanal estimado |
| `screenshots/02-calendario.png` | Calendario | La semana por días y comidas, con "Cocinado" y "Descartar" en cada plato | Calendario semanal de Fresco con los platos de cada día |
| `screenshots/03-biblioteca.png` | Biblioteca | Catálogo de recetas con buscador, filtros y etiquetas de dieta | Biblioteca de recetas de Fresco con etiquetas de dieta |
| `screenshots/04-aprendizaje-pro.png` | Menú (Pro) | El aviso de aprendizaje con cifras propias: evita las recetas ya cocinadas y deja fuera las descartadas | Menú de Fresco con el aviso de que evita 12 recetas ya cocinadas y deja fuera 3 descartadas |
| `screenshots/05-lista-compra.png` | Lista de la compra | 26 artículos pendientes por sección, con cantidad, precio estimado y el plato de origen | Lista de la compra de Fresco con artículos pendientes, cantidades y precios orientativos |

### Cómo se hicieron las dos últimas

La cuenta de pruebas Pro tenía un historial sembrado a mano: la semana `2026-W42` con 12 platos cocinados, 3 descartados y 6 pendientes (FRESCO-897). El aviso de `04` lo calculó la función `generate-meal-plan` sobre ese historial; no está maquetado.

### Capturas que faltan y por qué

- **Detalle de receta:** descartada. Los pasos de preparación de las recetas de ejemplo son demasiado pobres para una ficha pública.

### Limitación conocida

En `01-menu-semanal.png` y en `04-aprendizaje-pro.png` el desayuno sale con una letra gris en lugar de foto, porque esa receta aún no tiene imagen en el catálogo.
