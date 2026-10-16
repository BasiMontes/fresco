# Evaluación de la API de extracción de datos web de Decodo (FRESCO-977)

> **Estado: COMPLETA. Recomendación: aplazar, no adoptar ahora.** Es una decisión de negocio (`decision_authority.product: escalate`): la confirma el fundador. No hay ninguna clave, cuenta ni dato de la muestra dentro del repositorio.

Origen: post patrocinado de @midudev (15 oct 2026, https://x.com/midudev/status/2110793074356195622), marcado «Paid partnership», con enlace de afiliado `midu.link/decodo`. No es un repositorio: es un servicio de pago con crédito gratuito, la **Web Data API de Decodo** (antes Smartproxy). Todas las consultas se hicieron contra `decodo.com` y `help.decodo.com`, nunca contra el enlace de afiliado. Fecha de consulta de todas las fuentes: 2026-10-16.

## Corrección: contexto previo que esta evaluación no leyó

Este informe se escribió sin leer las decisiones ya tomadas sobre precios de supermercados, y varias de sus conclusiones dependían de ese contexto. Lo que ya existe:

| Documento | Qué decide |
|---|---|
| ADR-0027 | Integración con supermercados y comparador de precios fuera de la lista de exclusiones. Restricción permanente: **sin gasto extra** |
| ADR-0028 | Mercadona: lectura de su API pública de catálogo y precios bajo `riesgo-aceptado`, tras revisar sus condiciones. Hoy se alimenta de un dataset comunitario (`datania/mercadona-catalog`), sin añadir peticiones a Mercadona (FRESCO-762, refresco semanal) |
| ADR-0036 | Capa de datos de supermercados: contrato único de conector, modelo de precios en Postgres y **puerta legal en código**: solo se ejecuta un conector con `permiso` `concedido` o `riesgo-aceptado` y con un documento que lo respalde |
| ADR-0037 | Consum: conector bajo `riesgo-aceptado` mientras la petición de consentimiento no tiene respuesta |

Estado de lo pendiente: Día (FRESCO-765) y Alcampo (FRESCO-766) esperan consentimiento por escrito y están bloqueadas; Carrefour tiene la solicitud de afiliación en Awin lista para hacerse (FRESCO-753, con posible feed de producto y precio); el comparador (FRESCO-346) y la investigación de 19 cadenas (FRESCO-747) están bloqueados.

Qué corrige esto en este informe:

- **El caso de uso sí existe y ya está en marcha** para Mercadona y Consum. La fila «¿Hay un caso de uso?» y el primer motivo de la recomendación eran incorrectos.
- **Mercadona no está «pendiente de lectura»:** ya se leyeron sus condiciones y hay decisión (ADR-0028). El 403 que recibí en su aviso legal solo describe a mi cliente automatizado.
- **El obstáculo de Día, Alcampo y Carrefour no es técnico.** La puerta legal que decide si una cadena puede ejecutarse es una decisión del fundador por escrito; un servicio de desbloqueo no la sustituye y, además, subiría el riesgo de «leer una API pública» a «evadir las defensas antibot», que es otra decisión, no cubierta por ninguno de los ADR.

## Resumen

| Pregunta | Respuesta |
|---|---|
| ¿Funciona? | Sí. 11 `/scrape`, 1 `/map` y 1 `/crawl` de 5 páginas, todos correctos sobre sitios de práctica |
| ¿Es gratis? | Es un **crédito único de 5 $** (el panel marca `0 / 5 $`), no «10K peticiones al mes». 5 $ son 10K páginas solo con proxy estándar y sin JavaScript; con la configuración por defecto, 5K |
| ¿Aporta algo que no tengamos? | Lo que anuncia como diferencial (saltarse CAPTCHAs y bloqueos antibot) no se puede probar contra webs ajenas sin incumplir sus protecciones, así que no está verificado. Lo demás, con Tavily instalado ya se obtiene, más rápido |
| ¿Hay un caso de uso de Fresco que lo necesite? | **Sí: precios de supermercados** (corregido: ya existe la capa de datos y funciona para Mercadona y Consum). Lo que Decodo añadiría sería llegar a cadenas que bloquean bots (Día, Alcampo, Carrefour), y ahí el límite es el permiso, no la técnica (ver la corrección de arriba). Para imágenes con licencia y recetas, no |
| Recomendación | **Aplazar.** Retomar solo si aparece una fuente legalmente clara que exija renderizado de JavaScript a volumen |

## Qué se probó y cómo

- Cuenta gratuita creada por el fundador, sin que el panel marcara ningún cobro (saldo `$0,00`). La clave se guardó en `.env` como `DECODO_API_TOKEN` y se usó solo por nombre.
- Endpoint: `https://data.decodo.com/v1`, `Authorization: Bearer <API key>`.
- Solo sitios hechos para practicar scraping: `books.toscrape.com`, `quotes.toscrape.com`, y el `ip.decodo.com` del propio proveedor. Ninguna web de terceros.
- Los primeros intentos (unos 25) dieron `401` por usar una clave de otro producto de Decodo (las claves de la Web Scraping API antigua no valen en la Web Data API). No consumieron saldo.
- Peticiones facturables: 11 `/scrape`, 1 `/map`, 5 páginas de `/crawl`. Coste estimado con su tabla de precios: **0,013 $ (0,26 % del crédito)**. No se ha podido confirmar en el panel de consumo.

## Resultados medidos

| Prueba | Resultado | Tiempo | Coste estimado |
|---|---|---|---|
| `/scrape` de `ip.decodo.com`, proxy estándar | 200 | 0,65 s | 0,0005 $ |
| `/scrape` de 3 páginas de catálogo, estándar | 20 productos cada una; la página 1 son los mismos 50.449 caracteres que una petición directa | 1,3 a 1,5 s | 0,0015 $ |
| Misma página con proxy `premium` (el valor por defecto) | Idéntico | 1,07 s | 0,001 $ (el doble) |
| Misma página con `markdown: true` | 10.318 caracteres (un 80 % menos). Conserva 20 precios, 20 imágenes y 114 enlaces, pero mantiene el menú de navegación y los enlaces son relativos | 1,25 s | 0,0005 $ |
| Página renderizada con JavaScript, sin renderizar | 0 citas: devuelve la carcasa vacía | 1,19 s | 0,0005 $ |
| La misma con `headless: html` | 10 citas | **16,3 s** | 0,00075 $ |
| URL inexistente en el destino | HTTP 200 del servicio con `status_code: 404` en el cuerpo. Según su tabla de códigos, se factura si la respuesta no está vacía | 1,1 s | posible cargo |
| Clave inválida | 401 `Invalid credentials` | 0,05 s | 0 |
| `/map` de la portada, sin sitemap | 73 URLs en un `results[].content.links` | 3,8 s | 0,001 $ |
| `/crawl` con `limit: 5`, `max_depth: 1`, `markdown` | 202 al instante, `status: done` a los 5,1 s, 5 de 5 páginas, 0 fallos, 6 peticiones contabilizadas | 5,1 s | 0,005 a 0,006 $ |
| Petición directa sin servicio, misma página de catálogo | 200, 50.449 caracteres | 0,5 s | 0 |

Cabeceras de límite observadas: `ratelimit-limit: 200;w=1`, `x-plan-limit: 10`. La primera es el techo general y la segunda el del plan gratuito (10 peticiones por segundo).

## Facturación (la documentación contradice a la página comercial)

Fuente: https://help.decodo.com/docs/web-data-api-billing. Precio por 1.000 peticiones en el plan gratuito:

| Configuración | $ por 1K |
|---|---|
| `/scrape` proxy estándar | 0,50 |
| `/scrape` estándar + JavaScript | 0,75 |
| `/scrape` proxy `premium` (**el valor por defecto**) | 1,00 |
| `/scrape` premium + JavaScript | 1,50 |
| `/crawl` y `/map` (siempre premium) | 1,00 (1,50 con JavaScript) |
| `/search` | 0,75 |

- Solo se cobran las peticiones correctas. Los fallos del lado del proveedor (500, 524 y 613) no se cobran.
- Por tanto, «sin multiplicadores ocultos por JavaScript o sitios protegidos» (página comercial) es falso: JavaScript suma un 50 % y el valor por defecto duplica el precio.
- Con 5 $: 10.000 páginas estándar, 6.667 con JavaScript, 5.000 por defecto o por `/crawl`.
- Si no hay método de pago asociado (el alta no lo pidió, no confirmado), no puede haber un cargo al agotarse el crédito; su tabla de códigos devuelve `429` cuando no queda saldo. No se agotó para comprobarlo.

## Lo que publica el proveedor sobre uso legal

- Su guía (`web-scraping-api-introduction`): «intended for collecting publicly accessible web data»; no soporta contenido tras inicio de sesión, información privada ni datos restringidos. «Users are responsible for ensuring their use of the service complies with applicable website terms and internal policies.»
- Su contrato (https://decodo.com/legal/license-agreement): el cliente es el único responsable del contenido de terceros al que accede, no puede violar las restricciones de quien lo originó «estén publicadas o no», y entre las actividades prohibidas están violar derechos de autor, privacidad y datos personales, con posibles sanciones civiles, administrativas y penales.

Conclusión: el proveedor vende la capacidad de saltarse bloqueos y traslada toda la responsabilidad legal sobre el destino a Fresco.

## Fuentes candidatas: `robots.txt` y condiciones de uso

El `robots.txt` se descargó una vez por sitio con un agente identificado. No se extrajo ninguna página de contenido de ellos.

| Fuente | Uso previsto | `robots.txt` | Condiciones de uso | Veredicto |
|---|---|---|---|---|
| Mercadona (`www`) | Catálogo y precios | `User-agent: *` con `Disallow:` vacío | Aviso legal: 403 a mi cliente automatizado, no leído aquí | **Ya decidido: `riesgo-aceptado`, ADR-0028** (sus condiciones se revisaron en esa decisión) |
| Mercadona (`tienda`) | Catálogo y precios | `Disallow: /` salvo `/product` y `/sitemap.xml`; bloquea `/api` y `/legal` | Ver ADR-0028 | **Ya decidido** (ADR-0028); hoy se lee el dataset comunitario, sin peticiones propias |
| Carrefour | Catálogo y precios | Sin bloque para `*`; 83 reglas `Disallow` para agentes con nombre | Aviso legal: 403 a mi cliente automatizado, no leído aquí | Sin conector; solicitud de afiliación en Awin lista (FRESCO-753) |
| Día | Catálogo y precios | `robots.txt` responde 403 a un cliente automatizado | No leídas | **Descartada** |
| Cookpad | Recetas | `*` permite casi todo; bloquea con `Disallow: /` a GPTBot, CCBot y ClaudeBot | URL no localizada | **Descartada** |
| Directo al Paladar | Recetas y fotos | `*` permite casi todo; bloquea MJ12bot, AI2Bot y Diffbot | No localizadas | **Descartada**: contenido editorial |
| Recetasgratis | Recetas | `*` veta búsqueda, administración y `ajax` | URL no localizada | Pendiente; contenido editorial |
| Wikimedia Commons | Imágenes con licencia | `*` veta `/w/` y `/api/` a rastreadores genéricos | Los Términos de Uso exigen User-Agent identificado, cumplir la Robot Policy y API:Etiquette | **No por un servicio de scraping**: no garantiza el User-Agent identificado que su política exige. Sí por su API oficial |

Los dos supermercados que se consultaron responden 403 a un cliente automatizado incluso en su aviso legal, y Día lo hace en su `robots.txt`. Esa respuesta es una señal de que no quieren automatización y se respeta, sin usar un servicio de desbloqueo para esquivarla.

## Comparación con lo que ya tenemos

| Capacidad | Decodo Web Data API | Tavily (ya instalado en el entorno) | Petición directa |
|---|---|---|---|
| Página estática de catálogo a Markdown | 1,25 s. Incluye el menú y los enlaces relativos; títulos completos en el texto | Solo el contenido principal, con 20 productos, precio, enlace e imagen; títulos largos truncados en el texto (el atributo conserva el completo) | 0,5 s, sin conversión |
| Página renderizada con JavaScript | 16,3 s | 2,8 s con `extract_depth: advanced` | No funciona |
| Rastrear un sitio completo | `/crawl` y `/map` propios, hasta 10.000 páginas | `tavily_crawl` y `tavily_map` (no probados en esta pasada) | No |
| Datos estructurados genéricos | No: `parse` solo existe con plantillas (Google, Amazon, etc.) | No | No |
| Límite | 10 peticiones por segundo en el plan gratuito; crédito único de 5 $ | `429` tras unas diez llamadas seguidas; plan y cuota sin consultar | Sin límite propio |
| Anti-CAPTCHA y antibot | Anunciado. **No verificado** | No aplica | No |

Alternativas que no se probaron, y por qué: Firecrawl (1.000 créditos gratuitos al mes), ZenRows y otras requieren otra cuenta externa. No se crearon porque la prueba en sitios de práctica no distingue entre ellas, y el cuello de botella no es técnico sino legal.

## Respuestas a las seis preguntas

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Gratuito recurrente o crédito único? ¿Pide tarjeta? | Crédito único de 5 $ (`0 / 5 $` en el panel). El alta se hizo sin cobro (saldo 0,00 $). Que el crédito se renueve cada mes no consta en ningún sitio; el post y su página de `/crawl` dicen «recurrente» sin respaldo en el panel ni en la tabla de precios |
| 2 | ¿Qué pasa al agotarlo? | Si no hay método de pago asociado (no confirmado), no puede haber cargo; su tabla de códigos devuelve `429`. No se ha agotado para comprobarlo |
| 3 | ¿Qué funciona en las fuentes que nos interesan? | En sitios de práctica, todo (estático, JavaScript, `/map`, `/crawl`). En las fuentes reales no se probó: están descartadas o sin condiciones leídas |
| 4 | ¿Calidad del dato frente a Unsplash, Pexels y Pixabay? | No comparable: esas APIs devuelven una foto con licencia y atribución; Decodo devuelve el HTML o el Markdown de una página, sin estructura y sin licencia |
| 5 | ¿Qué parte ya tenemos? | Tavily cubre extracción, rastreo y mapa, y en la prueba renderiza JavaScript 6 veces más rápido |
| 6 | ¿Datos personales o con derechos de autor? | Recetas y fotos editoriales: derechos de autor, descartadas. Precios y catálogos de supermercado: datos públicos, con el derecho del fabricante de bases de datos como riesgo a valorar con asesoría jurídica antes de extraerlos. Sin datos personales en las fuentes elegidas |

## Recomendación

**Aplazar.** Motivos:

1. **El caso de uso (precios de supermercados) ya está cubierto donde hay permiso y bloqueado donde no.** Mercadona y Consum funcionan por la capa de FRESCO-770 con su puerta legal; Día y Alcampo esperan consentimiento y Carrefour, la afiliación de Awin (FRESCO-753, sin coste y con posible feed de precios). Las fotos y recetas del catálogo se cubren con APIs oficiales y licencias.
2. **El valor diferencial no es probable de verificar sin infringir.** Saltarse protecciones de webs ajenas es justo lo que el proveedor anuncia y lo que su propio contrato deja a cargo del cliente.
3. **La alternativa ya instalada es mejor para lo comprobable.** Más rápida con JavaScript y con salida más limpia, sin cuenta nueva.
4. **El coste no es el problema, y por eso no compensa el riesgo.** Mil páginas al mes cuestan 0,50 $; el obstáculo es legal.

Condiciones para retomarlo:

- Aparece una fuente concreta con condiciones de uso favorables y que exija renderizado de JavaScript a volumen, o
- el fundador obtiene asesoría jurídica favorable sobre la extracción de precios de supermercados, o
- se prefiere un acuerdo de datos con el supermercado (afiliados o feed), que sería la vía correcta y no un servicio de desbloqueo.

Si se adopta algún día: ADR en `.context/ADR/` (dependencia de un tercero y tratamiento de datos) y tarjetas hijas en FRESCO-867 para la integración; nada se ha integrado aquí.

## Qué queda abierto

- El gasto real no se ha confirmado en la pestaña «Usage statistics» del panel de Decodo; la cifra de 0,013 $ es una estimación con su tabla de precios.
- La cuenta de Decodo y su clave existen fuera del repositorio. Si no se va a retomar, conviene borrar la cuenta y la variable `DECODO_API_TOKEN` de `.env`. Es decisión del fundador.
- Condiciones de Carrefour y Recetasgratis: sin leer. Para Carrefour manda la solicitud de Awin (FRESCO-753); Mercadona y Consum ya tienen decisión (ADR-0028 y ADR-0037); Día y Alcampo esperan consentimiento (FRESCO-765 y FRESCO-766).
- `/crawl` y `/map` de Tavily no se midieron.

## Referencias

- Post: https://x.com/midudev/status/2110793074356195622
- Producto: https://decodo.com/web-data-api
- Documentación de la Web Data API: https://help.decodo.com/docs/web-data-api-introduction y https://help.decodo.com/docs/web-data-api-billing
- Migración desde la Web Scraping API: https://help.decodo.com/docs/web-data-api-migration-guide
- Códigos de respuesta: https://help.decodo.com/docs/web-data-api-response-codes
- Contrato de licencia: https://decodo.com/legal/license-agreement
- Términos de Wikimedia: https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use
- Comparativas de terceros (con sesgo comercial): https://scrape.do/blog/best-web-scraping-api
