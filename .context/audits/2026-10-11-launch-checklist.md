# Fresco frente a la checklist de lanzamiento (productlaunchchecklist.com)

> **Ticket**: FRESCO-877. **Fecha**: 2026-10-11. **Fuente**: <https://productlaunchchecklist.com/> (texto completo en `llms-full.txt`, 66 puntos, leído el 2026-10-11).
> **Alcance**: checklist general más las variantes **Website** y **SaaS**. La variante **App** no aplica: Fresco es una web app (la web instalable por manifest no es una app de tienda, así que no hay revisión de App Store ni de Google Play). Tampoco aplican los puntos de AI tool, extensión de navegador, código abierto ni developer tool.
> **Método**: cada punto se contrastó con el repo, con Jira y con la web de producción (`https://fresco-pro.vercel.app`, solo lectura: `curl -I`). La evidencia está en la tabla. No se ha tocado nada.

## Resumen

**Cumplimos 16 de los 35 puntos que aplican antes del lanzamiento (46 %). Otros 9 se cumplen a medias y 10 faltan.**

| Estado | Puntos | Qué significa |
|---|---|---|
| Cumple | 16 | Hecho y con evidencia |
| Parcial | 9 | Existe, pero con un hueco concreto (ver tabla) |
| Falta | 10 | No hay nada o no lo encontré |
| No aplica (por tipo de producto) | 19 | Puntos de App, AI tool, extensión, código abierto y developer tool |
| No aplica aún (posterior al lanzamiento o informativo) | 12 | Son acciones del día de lanzamiento o posteriores, o consejos sin acción: se evalúan entonces |
| **Total revisado** | **66** | 0 sin clasificar |

Dónde están los 10 huecos, en una línea: **no hay plan de lanzamiento** (fecha, plataformas, decisión sobre Product Hunt, textos de lanzamiento), **no hay forma de recoger interés temprano**, **no hay Search Console ni Bing verificados**, y **no hay dominio propio**, de lo que cuelgan el correo desde dominio propio y el contacto.

## Tabla punto por punto

Leyenda de estado: ✅ cumple · 🟡 parcial · ❌ falta · ➖ no aplica · ⏳ no aplica aún. "Must" es *Must do* en la checklist; "Worth" es *Worth doing*.

### 1. Antes de lanzar

| Id | Punto | Tipo | Estado | Evidencia |
|---|---|---|---|---|
| b1 | Descripción de una línea | Must | ✅ | `metadata.description` en `app/layout.tsx`; título y h1 de la landing trabajados en FRESCO-475 |
| b2 | A quién va dirigido, en una frase | Must | ✅ | Persona Laura en `.context/PRD/` y mensaje de la landing |
| b3 | Precio y plan de pago desde el día uno | Must | ✅ | Free y Pro (mensual y anual), cobro con Stripe; sección `#pricing` con importes leídos de Stripe (FRESCO-871, FRESCO-844) |
| b4 | Recoger interés temprano (lista de espera) | Worth | ❌ | Ninguna coincidencia de *waitlist* o *lista de espera* en el repo |
| b5 | Fijar fecha de lanzamiento | Must | ❌ | No encontré ningún documento con fecha o plan de lanzamiento; las menciones de "lanzamiento público" están en ADR-0020 y ADR-0037 como condiciones previas, no como fecha |

### 2. Producto listo

| Id | Punto | Tipo | Estado | Evidencia |
|---|---|---|---|---|
| p1 | Probar registro y onboarding con cuenta nueva | Must | ✅ | Escenarios e2e de invitado y de registro con usuarios nuevos (`testUserFactory`), en `.context/qa/regression.feature` |
| p2 | Analítica y saber el número que importa | Must | ✅ | PostHog (con consentimiento de cookies) y la consulta `scripts/queries/mvp-success-bar.sql` (FEAT-108) |
| p3 | Seguimiento de errores | Must | ✅ | Sentry en cliente, servidor y Edge Functions |
| p4 | Correo transaccional desde dominio propio | Must | 🟡 | Supabase Auth envía por SMTP de Gmail (`hola.frescoapp@gmail.com`): llega, pero no es dominio propio y tiene límite de envíos de Gmail |
| p5 | Probar pagos de extremo a extremo, incluido un reembolso | Must (SaaS) | 🟡 | Checkout, webhook, reconciliación diaria y `stripe-e2e.yml` semanal; no hay prueba del reembolso ni documentada una ejecución en modo live |
| p6 | Política de privacidad y términos | Must | 🟡 | Páginas legales publicadas y rastreables (FRESCO-493); los textos son provisionales a la espera de abogado |
| p7 | Límites de uso (AI tool) | Must | ➖ | Fresco no usa ningún modelo externo desde ADR-0005 |

### 3. Web lista

| Id | Punto | Tipo | Estado | Evidencia |
|---|---|---|---|---|
| w1 | HTTPS y redirecciones | Must | ✅ | `http://` responde `308` a `https://` en una sola redirección. Con dominio propio habrá que repetir la prueba con y sin `www` |
| w2 | Título y descripción en cada página | Must | ✅ | FRESCO-473 (metadata por ruta y política de indexación) |
| w3 | Imagen para compartir (Open Graph) | Must | ✅ | FRESCO-470; `/opengraph-image` responde `200` |
| w4 | Favicon | Worth | 🟡 | `icon.svg`, `apple-icon.png` y manifest responden bien; `/favicon.ico` da `404` |
| w5 | Sitemap y robots.txt | Worth | ✅ | `robots.txt` y `sitemap.xml` responden `200` (FRESCO-474) |
| w6 | Página 404 útil | Worth | ✅ | `app/not-found.tsx`; una ruta inexistente devuelve `404` real |
| w7 | Carga rápida en móvil | Must | 🟡 | FRESCO-496 trató CLS móvil y JS sin usar; no hay medición de Core Web Vitals en producción posterior |
| w8 | Search Console y Bing verificados | Worth | ❌ | No hay etiqueta de verificación en el código; el pendiente de FRESCO-477 era el inicio de sesión de Search Console |
| w10 | Que un asistente de IA pueda leer y recomendar el producto | Worth | ✅ | `llms.txt` (FRESCO-494), datos estructurados JSON-LD (FRESCO-472) y `robots.txt` que no bloquea rastreadores de IA |
| w9 | Dirección de contacto a la que se pueda escribir | Must | 🟡 | El contacto es un Gmail (A6-P13); seguimiento en FRESCO-883 |

### 4. Materiales de lanzamiento

| Id | Punto | Tipo | Estado | Evidencia |
|---|---|---|---|---|
| a1 | Logo cuadrado y apaisado | Must | ✅ | `public/brand/` (varias versiones) y manual de marca `docs/brand/index.html` (FRESCO-424) |
| a2 | Tres a cinco capturas del producto en uso | Must | ❌ | No hay un juego de capturas preparado para fichas de directorios |
| a3 | Vídeo o GIF corto de demostración | Worth | ✅ | `public/video/fresco-brand.mp4` en la landing (FEAT-105) |
| a4 | Descripción corta y larga, escritas una vez | Must | 🟡 | Existen la descripción de metadata y el FAQ, pero no un kit de textos reutilizable |
| a5 | Primer comentario explicando por qué lo hiciste | Worth | ❌ | Depende de elegir plataforma; no existe |
| a6 | Respuestas a las cinco preguntas habituales | Worth | 🟡 | El FAQ de la landing tiene 6 preguntas (tarjeta, alergias, cambiar recetas, veganos, cancelar, familias); faltan precio detallado, privacidad, competidor y "por qué no usar el grande" |

### 5. Salir en listados

| Id | Punto | Tipo | Estado | Evidencia |
|---|---|---|---|---|
| g1 | Saber qué directorios y plataformas aceptan el producto | Must | ❌ | No hay estudio ni lista |
| g2 | Dejar hueco en el pie para insignias | Worth | ❌ | No encontré insignias ni hueco previsto para ellas en los componentes de la landing |
| g3 | Contar con crear cuenta en la mayoría | Worth | ⏳ | Consejo de planificación, sin acción propia |
| g4 | Reservar pronto las fechas de lanzamiento programado | Must | ❌ | Depende de g1 y de b5 |
| g5 | No contar con un enlace de retorno de cada listado | Worth | ⏳ | Consejo informativo |
| g6 | Tiendas de apps y registros | Must | ➖ | Solo para App, extensión, AI tool y código abierto |

### 6. Día de lanzamiento

| Id | Punto | Tipo | Estado | Evidencia |
|---|---|---|---|---|
| d1 | Decidir si Product Hunt encaja | Worth | ❌ | No hay decisión escrita |
| d2 | Publicar un Show HN | Worth | ➖ | Solo developer tool y código abierto |
| d3 | Escribir a quienes pidieron enterarse | Must | ⏳ | Es una acción del día; hoy no hay lista (b4) |
| d4 | Publicar en las redes donde ya están tus usuarios | Must | ❌ | No hay cuentas de redes enlazadas en el repo ni en la landing |
| d5 | Responder a todos los comentarios | Must | ⏳ | Acción del propio día |

### 7. Primera semana

| Id | Punto | Tipo | Estado | Evidencia |
|---|---|---|---|---|
| k1 | Escribir a quien se registró y no empezó | Must | ⏳ | Posterior al lanzamiento |
| k2 | Hablar con cinco personas que lo usaron | Must | ⏳ | Posterior al lanzamiento |
| k3 | Pedir testimonios | Worth | ⏳ | Posterior al lanzamiento |
| k4 | Arreglar los tres problemas más reportados | Must | ⏳ | Posterior al lanzamiento |
| k5 | Escribir un resumen con números reales | Worth | ⏳ | Posterior al lanzamiento |

### 8. Primer mes

| Id | Punto | Tipo | Estado | Evidencia |
|---|---|---|---|---|
| m1 | Saber qué listado o publicación trajo visitas | Must | ⏳ | Posterior al lanzamiento; la base (PostHog) ya está |
| m2 | Entrar en "mejores herramientas" y páginas de alternativas | Worth | ⏳ | Posterior al lanzamiento |
| m3 | Seguir enviando a un ritmo constante | Worth | ⏳ | Posterior al lanzamiento |

### 9. Específicos por tipo

| Id | Punto | Tipo | Estado | Evidencia |
|---|---|---|---|---|
| t1 a t5 | Revisión de tienda, capturas por dispositivo, etiquetas de privacidad, beta cerrada, palabras clave (App) | Must/Worth | ➖ | Fresco es una web app |
| t6 | Elegir entre prueba y plan gratis | Must (SaaS) | ✅ | Plan Free permanente y prueba de 7 días de Pro (`PRO_TRIAL_DAYS`), una vez por persona (FEAT-100) |
| t7 | Gestionar los pagos fallidos | Must (SaaS) | 🟡 | El webhook marca `payment_failed_at` en `past_due` y la reconciliación diaria corrige; los correos al cliente por pago fallido dependen de la configuración de Stripe, que no he podido verificar |
| t8 | Página de precios en la web | Must (SaaS) | ✅ | Sección `#pricing` enlazada desde la navegación, con importes de Stripe y el selector mensual y anual |
| t9 a t19 | AI tool, extensión, código abierto, developer tool | Must/Worth | ➖ | No aplica al tipo de producto |

## Huecos priorizados y cards propuestas

Ordenados por impacto en el lanzamiento y esfuerzo. **No se ha creado ninguna card:** espero tu visto bueno.

| # | Propuesta de card | Puntos que cierra | Impacto | Esfuerzo | Quién |
|---|---|---|---|---|---|
| 1 | Plan de lanzamiento: fecha, plataformas candidatas, decisión sobre Product Hunt y redes | b5, g1, g4, d1, d4 | Alto | S (decisión y documento) | Fundador decide, yo redacto |
| 2 | Comprar dominio propio y pasar el correo y el contacto a él | p4, w9 (y desbloquea w8) | Alto | M | Fundador (compra); relaciona con FRESCO-883 |
| 3 | Verificar Search Console y Bing con etiqueta en el código | w8 | Medio | S | Yo; no necesita dominio propio si se verifica por prefijo de URL |
| 4 | Lista de espera o formulario de interés temprano | b4 (y deja listo d3) | Medio | M | Yo, con una decisión de producto tuya |
| 5 | Juego de capturas del producto y kit de descripciones corta y larga | a2, a4, a5 | Medio | S | Yo |
| 6 | Probar el reembolso de extremo a extremo y revisar los correos de pago fallido en Stripe | p5, t7 | Medio | S | Los dos: toca Stripe en modo live |
| 7 | Ampliar el FAQ con precio, privacidad, competidor y "por qué no usar el grande" | a6 | Bajo | S | Yo |
| 8 | Medir Core Web Vitals en producción con PageSpeed Insights | w7 | Bajo ahora | XS | Yo |
| 9 | Añadir `favicon.ico` en la raíz | w4 | Bajo | XS | Yo |

**Ya cubierto por trabajo existente, sin card nueva:** textos legales provisionales a la espera de abogado (p6; ADR-0037 y el borrador de FRESCO-365) y el contacto en Gmail (FRESCO-883).

## Qué no cubre este informe

- Los puntos marcados como cumple se comprobaron en el código, en Jira o con una petición a producción; **no he repetido las auditorías de SEO y de rendimiento** (FRESCO-469, FRESCO-484, FRESCO-775), solo las he cruzado.
- Los 12 puntos "no aplica aún" se evaluarán en el lanzamiento; no suman ni restan al recuento.
- La checklist es de un tercero y cambia: este informe corresponde a la lectura del 2026-10-11.
