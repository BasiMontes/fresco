# Plan de lanzamiento público de Fresco

> **Ticket**: FRESCO-885 (epic FRESCO-884). **Decidido el**: 2026-10-11 por el fundador. **Origen**: huecos b5, g1, g4, d1 y d4 de `.context/audits/2026-10-11-launch-checklist.md` (FRESCO-877).
> **Estado**: vivo. Cualquier cambio de fecha o de canal se anota en la sección "Registro de cambios" al final, con fecha y motivo.

## Decisiones

| Decisión | Resultado | Motivo |
|---|---|---|
| Fecha de lanzamiento | **Martes 1 de diciembre de 2026** | Siete semanas desde la decisión. Queda fuera de la semana del Black Friday (27 de noviembre), donde cualquier lanzamiento compite con las ofertas, y antes del puente del 6 al 8 de diciembre. Un martes es mejor día que un fin de semana o un lunes |
| Product Hunt | **No** | El comprador de Fresco son hogares en España, con producto, catálogo y supermercados en español. Product Hunt es sobre todo público tecnológico en inglés (apreciación, no dato medido). Se reconsidera si algún día hay versión en inglés |
| Canales de lanzamiento | **Instagram y TikTok de cocina, y comunidades de recetas y organización del hogar, en español** | Es donde está el público de Fresco y encaja con el vídeo de marca que ya existe (`public/video/fresco-brand.mp4`). Exige abrir cuentas y publicar con constancia las semanas previas |
| Presupuesto | **Sin gasto adicional por ahora** (decidido el 2026-10-11) | No hay presupuesto. Cualquier paso de pago (dominio, abogado, planes de pago) se aplaza hasta nueva decisión. El dominio elegido, `frescoapp.es`, **no se ha comprado** |
| Directorios y plataformas con cola de lanzamiento (g1, g4) | **A confirmar.** Propuesta: g4 no aplica (sin Product Hunt no hay plataformas con cola programada); los directorios en español se evalúan en la semana 5 como complemento y no condicionan la fecha | Decisión por defecto del agente, pendiente de que el fundador la revise |

## Condiciones que mueven la fecha

Cuatro cosas están escritas como condición del lanzamiento público. **Con la decisión de no gastar, las cuatro que cuestan dinero quedan sin resolver**, así que el 1 de diciembre depende de la decisión de la sección siguiente.

| Condición | Dónde está escrita | Cuesta dinero | Estado | Fecha límite (propuesta) |
|---|---|---|---|---|
| Opinión de un abogado sobre derechos de bases de datos del catálogo de Consum | `ADR-0037`: "obligatoria antes del lanzamiento público" | Sí | **Aplazada** | 17 de noviembre |
| Textos legales revisados por abogado (hoy provisionales) | Borrador de FRESCO-365; `ADR-0040` | Sí | **Aplazada** | 17 de noviembre |
| Dominio propio, con el correo de registro y el contacto en él | FRESCO-886; hallazgo A6-P13 (FRESCO-883) | Sí | **Elegido (`frescoapp.es`), no comprado.** FRESCO-886 en `Blocked` | 3 de noviembre |
| Proyecto de Supabase separado del de pruebas, o una decisión escrita de mantenerlo | `ADR-0020`, condición 4 de revisión: un lanzamiento público más allá de la cohorte cerrada, o cualquier suscripción de pago real, hace que el aislamiento de los datos de producción sea imprescindible | Probablemente (el ADR habla de Supabase Pro) | **Pendiente de decisión** | 24 de noviembre |

Las fechas límite son una **propuesta del agente**, calculada hacia atrás desde el 1 de diciembre. El fundador las confirma o las cambia.

## Sin presupuesto: dos caminos

**Hay que elegir antes del 3 de noviembre**, que es la primera fecha límite que se incumple.

| | Camino 1: lanzar el 1 de diciembre sin gastar | Camino 2: mover la fecha hasta tener presupuesto |
|---|---|---|
| Correo y contacto | El registro sigue saliendo por el SMTP de Gmail y el contacto publicado sigue siendo `hola.frescoapp@gmail.com` (el hueco A6-P13, ya aceptado, FRESCO-883) | Pasan a `frescoapp.es` al comprarlo |
| Catálogo de Consum | Gratis: se retira el conector de Consum del registro (`lib/grocery/supermarket/registry.ts`), que es el interruptor que `ADR-0037` documenta y prueba. Sin Consum no hace falta la opinión del abogado sobre sus datos, y se pierden los enlaces y precios de Consum (queda Mercadona). Convendría anotarlo en un anexo del ADR | Se mantiene Consum y se paga la opinión antes de lanzar |
| Textos legales | Salen provisionales. **El riesgo legal de eso es del fundador y el agente no puede valorarlo**; conviene asesorarse | Revisados por abogado antes de lanzar |
| Proyecto de Supabase | Decisión escrita de mantener el proyecto único y por qué, o pagar el plan que haga falta | Se resuelve con el presupuesto |
| Qué se mantiene | Fecha, canales, lista de espera y el resto del plan | Se pierde la fecha del 1 de diciembre, que se vuelve a fijar |

El plan no elige: **la elección es del fundador**, y esta tabla solo dice qué se gana y qué se pierde con cada camino.

## Cuenta atrás

Hoy es el domingo 11 de octubre; el día D es el martes 1 de diciembre.

| Semana | Fechas | Qué tiene que pasar | Cards |
|---|---|---|---|
| T-7 | 12 a 18 oct | Abrir las cuentas de Instagram y TikTok. ~~Encargar al abogado la revisión de textos y la opinión de Consum~~ y ~~comprar el dominio~~: **aplazados por falta de presupuesto** (ver "Sin presupuesto: dos caminos") | FRESCO-886 (`Blocked`) |
| T-6 | 19 a 25 oct | Verificar Search Console y Bing por prefijo de URL sobre `fresco-pro.vercel.app`, que no necesita dominio propio. Primer calendario de contenido para redes. ~~Dominio apuntando a Vercel y correo desde él~~: aplazado | FRESCO-887 |
| T-5 | 26 oct a 1 nov | Lista de espera en producción, enlazada desde la landing y las redes. Empezar a publicar contenido con constancia | FRESCO-888 |
| T-4 | 2 a 8 nov | **Decidir el camino (3 nov): lanzar sin gastar o mover la fecha.** Probar el reembolso de extremo a extremo en Stripe live. Ampliar el FAQ. Evaluar los directorios en español | FRESCO-890, FRESCO-891 |
| T-3 | 9 a 15 nov | Capturas del producto y kit de textos (descripción corta y larga, primer comentario). Seguir con las redes | FRESCO-889 |
| T-2 | 16 a 22 nov | Con el camino 2, **fecha límite del abogado (17 nov)** y textos legales definitivos publicados. Con el camino 1, los textos salen provisionales y se confirma por escrito la decisión | FRESCO-365 |
| T-1 | 23 a 29 nov | Congelar el producto: solo arreglos. Ensayo general con una cuenta nueva (registro, menú, lista de la compra, pago y reembolso). Programar el correo a la lista y las publicaciones del día D | |
| **Día D** | **1 dic** | Correo a todos los de la lista de espera. Publicar en Instagram, TikTok y comunidades. Responder a todos los comentarios el mismo día | |
| D+1 a D+7 | 2 a 8 dic | Escribir a quien se registró y no empezó. Hablar con cinco personas que lo usaron. Arreglar los tres problemas más reportados. Pedir testimonios | |
| D+30 | hasta 1 ene | Saber qué canal trajo visitas (PostHog). Mantener un ritmo constante de publicaciones | |

## Qué cierra este plan en la checklist

| Punto | Estado después de este plan |
|---|---|
| b5, fecha de lanzamiento | Cumple: 1 de diciembre de 2026, **sujeta al camino que se elija antes del 3 de noviembre** (sin presupuesto, ver arriba) |
| d1, decidir Product Hunt | Cumple: decidido que no, con motivo |
| d4, redes donde están los usuarios | Parcial: canales decididos, cuentas por abrir en la semana T-7 |
| g1, qué directorios y plataformas aceptan el producto | Parcial: los directorios en español se evalúan en T-4 |
| g4, reservar fechas de lanzamiento programado | No aplica con esta estrategia (a confirmar) |

## Pendiente de decisión del fundador

- Confirmar o cambiar la propuesta sobre directorios (g1, g4).
- Quién publica el contenido de redes cada semana y con qué frecuencia. El plan solo exige constancia, no fija la cadencia.
- Qué nombre de cuenta se usa en cada red (depende de la marca y del dominio, FRESCO-886).
- **El camino 1 o el 2 de "Sin presupuesto: dos caminos", antes del 3 de noviembre.** Es la decisión que mueve la fecha.

## Registro de cambios

- 2026-10-11: plan creado con la fecha del 1 de diciembre de 2026.
- 2026-10-11: el fundador decide no gastar más dinero por ahora. Se elige `frescoapp.es` como dominio pero no se compra (FRESCO-886 pasa a `Blocked`). El dominio, el abogado y los textos legales quedan aplazados. Se añade la sección "Sin presupuesto: dos caminos" y se marca la fecha del 1 de diciembre como pendiente de esa decisión.
