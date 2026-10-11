# Plan de lanzamiento público de Fresco

> **Ticket**: FRESCO-885 (epic FRESCO-884). **Decidido el**: 2026-10-11 por el fundador. **Origen**: huecos b5, g1, g4, d1 y d4 de `.context/audits/2026-10-11-launch-checklist.md` (FRESCO-877).
> **Estado**: vivo. Cualquier cambio de fecha o de canal se anota en la sección "Registro de cambios" al final, con fecha y motivo.

## Decisiones

| Decisión | Resultado | Motivo |
|---|---|---|
| Fecha de lanzamiento | **Martes 1 de diciembre de 2026** | Siete semanas desde la decisión. Queda fuera de la semana del Black Friday (27 de noviembre), donde cualquier lanzamiento compite con las ofertas, y antes del puente del 6 al 8 de diciembre. Un martes es mejor día que un fin de semana o un lunes |
| Product Hunt | **No** | El comprador de Fresco son hogares en España, con producto, catálogo y supermercados en español. Product Hunt es sobre todo público tecnológico en inglés (apreciación, no dato medido). Se reconsidera si algún día hay versión en inglés |
| Canales de lanzamiento | **Instagram y TikTok de cocina, y comunidades de recetas y organización del hogar, en español** | Es donde está el público de Fresco y encaja con el vídeo de marca que ya existe (`public/video/fresco-brand.mp4`). Exige abrir cuentas y publicar con constancia las semanas previas |
| Directorios y plataformas con cola de lanzamiento (g1, g4) | **A confirmar.** Propuesta: g4 no aplica (sin Product Hunt no hay plataformas con cola programada); los directorios en español se evalúan en la semana 5 como complemento y no condicionan la fecha | Decisión por defecto del agente, pendiente de que el fundador la revise |

## Condiciones que mueven la fecha

El lanzamiento público no puede salir sin estas cuatro cosas. Si alguna no está en su fecha límite, **se mueve la fecha, no la condición**.

| Condición | Dónde está escrita | Fecha límite |
|---|---|---|
| Opinión de un abogado sobre derechos de bases de datos del catálogo de Consum | `ADR-0037`: "obligatoria antes del lanzamiento público" | **17 de noviembre** (dos semanas antes, para poder reaccionar) |
| Textos legales revisados por abogado (hoy provisionales) | Borrador de FRESCO-365; `ADR-0040` | **17 de noviembre** |
| Dominio propio, con el correo de registro y el contacto en él | FRESCO-886; hallazgo A6-P13 (FRESCO-883) | **3 de noviembre** (para que Search Console y el correo tengan tiempo de asentarse) |
| Proyecto de Supabase separado del de pruebas, o una decisión escrita de mantenerlo | `ADR-0020`, condición 4 de revisión: un lanzamiento público más allá de la cohorte cerrada, o cualquier suscripción de pago real, hace que el aislamiento de los datos de producción sea imprescindible | **24 de noviembre** |

Las fechas límite de esta tabla son una **propuesta del agente**, calculada hacia atrás desde el 1 de diciembre. El fundador las confirma o las cambia al aprobar este documento.

## Cuenta atrás

Hoy es el domingo 11 de octubre; el día D es el martes 1 de diciembre.

| Semana | Fechas | Qué tiene que pasar | Cards |
|---|---|---|---|
| T-7 | 12 a 18 oct | Encargar al abogado la revisión de textos y la opinión de Consum. Comprar el dominio. Abrir las cuentas de Instagram y TikTok | FRESCO-886 |
| T-6 | 19 a 25 oct | Dominio apuntando a Vercel y correo desde él. Verificar Search Console y Bing. Primer calendario de contenido para redes | FRESCO-886, FRESCO-887 |
| T-5 | 26 oct a 1 nov | Lista de espera en producción, enlazada desde la landing y las redes. Empezar a publicar contenido con constancia | FRESCO-888 |
| T-4 | 2 a 8 nov | **Fecha límite del dominio (3 nov).** Probar el reembolso de extremo a extremo en Stripe live. Ampliar el FAQ. Evaluar los directorios en español | FRESCO-890, FRESCO-891 |
| T-3 | 9 a 15 nov | Capturas del producto y kit de textos (descripción corta y larga, primer comentario). Seguir con las redes | FRESCO-889 |
| T-2 | 16 a 22 nov | **Fecha límite del abogado (17 nov).** Textos legales definitivos publicados. Si el abogado no llega, se decide aquí si se mueve la fecha | FRESCO-365 |
| T-1 | 23 a 29 nov | Congelar el producto: solo arreglos. Ensayo general con una cuenta nueva (registro, menú, lista de la compra, pago y reembolso). Programar el correo a la lista y las publicaciones del día D | |
| **Día D** | **1 dic** | Correo a todos los de la lista de espera. Publicar en Instagram, TikTok y comunidades. Responder a todos los comentarios el mismo día | |
| D+1 a D+7 | 2 a 8 dic | Escribir a quien se registró y no empezó. Hablar con cinco personas que lo usaron. Arreglar los tres problemas más reportados. Pedir testimonios | |
| D+30 | hasta 1 ene | Saber qué canal trajo visitas (PostHog). Mantener un ritmo constante de publicaciones | |

## Qué cierra este plan en la checklist

| Punto | Estado después de este plan |
|---|---|
| b5, fecha de lanzamiento | Cumple: 1 de diciembre de 2026 |
| d1, decidir Product Hunt | Cumple: decidido que no, con motivo |
| d4, redes donde están los usuarios | Parcial: canales decididos, cuentas por abrir en la semana T-7 |
| g1, qué directorios y plataformas aceptan el producto | Parcial: los directorios en español se evalúan en T-4 |
| g4, reservar fechas de lanzamiento programado | No aplica con esta estrategia (a confirmar) |

## Pendiente de decisión del fundador

- Confirmar o cambiar la propuesta sobre directorios (g1, g4).
- Quién publica el contenido de redes cada semana y con qué frecuencia. El plan solo exige constancia, no fija la cadencia.
- Qué nombre de cuenta se usa en cada red (depende de la marca y del dominio, FRESCO-886).

## Registro de cambios

- 2026-10-11: plan creado con la fecha del 1 de diciembre de 2026.
