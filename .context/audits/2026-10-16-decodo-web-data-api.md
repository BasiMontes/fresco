# Evaluación de la API de extracción de datos web de Decodo (FRESCO-977)

> **Estado: EN CURSO. Pasos 1 y 2 hechos (documentación, términos y `robots.txt`). Los pasos 3 a 6 (muestras, comparación con Tavily y alternativas, medición, recomendación) están pendientes.** No hay cuenta creada en Decodo ni se ha enviado ninguna petición a su API.

Origen: post patrocinado de @midudev (15 oct 2026, https://x.com/midudev/status/2110793074356195622), marcado «Paid partnership», con enlace de afiliado `midu.link/decodo`. No es un repositorio: es un servicio de pago con plan gratuito. Todas las consultas se han hecho contra `decodo.com`, no contra el enlace de afiliado. Fecha de consulta de todas las fuentes: 2026-10-16.

## Paso 1. Lo que publica el proveedor

### Dos nombres para dos documentaciones

| Nombre comercial | Qué se ha encontrado | Fuente |
|---|---|---|
| Web Data API (`/scrape`, `/crawl`, `/map`, `/search`) | Página comercial con precios y tabla de planes. **No se ha localizado su documentación técnica** de `/crawl`, `/map` y `/search` | https://decodo.com/web-data-api |
| Web Scraping API | Documentación técnica completa de un único endpoint: `POST https://scraper-api.decodo.com/v2/scrape`, autenticación `Basic`, modos síncrono, asíncrono y por lotes | https://help.decodo.com/docs/web-scraping-api-quick-start |

Pregunta abierta: si `/crawl`, `/map` y `/search` son el mismo producto que la «Web Scraping API» documentada, o uno nuevo con su propia documentación aún sin localizar.

### Plan gratuito: cuatro versiones que no coinciden

| Dónde | Qué dice |
|---|---|
| Página `web-data-api` | «$5 de crédito gratis, hasta 10K peticiones» (suena a crédito único) |
| Página del endpoint `/crawl` | «hasta 10K peticiones recurrentes, sin tarjeta» |
| Tabla de planes | «hasta 5K rastreos o 10K páginas al mes» en unas páginas y «19K rastreos o 38K páginas» en otras |
| Blog de Decodo | «prueba gratuita de 7 días» |
| Documentación técnica | «compra una prueba gratuita o una suscripción» para obtener las credenciales |

Sin aclarar: si es recurrente o puntual, y si el alta pide tarjeta. El post dice «sin poner tarjeta»; la documentación dice «comprar una prueba gratuita». No se resuelve sin crear la cuenta.

### Precio: la documentación contradice el «sin multiplicadores»

- Página comercial: «sin multiplicadores ocultos por renderizado JavaScript ni sitios protegidos».
- Documentación (`web-scraping-api-introduction`): el precio depende del tipo de proxy (*Standard* o *Premium*) y del renderizado de JavaScript, y activar el renderizado «aumenta el coste». Las plantillas de destino distintas de la genérica usan *Premium* por defecto.
- Portada de Decodo: «desde 0,09 $ por 1K peticiones» para la Web Scraping API.
- Análisis de terceros (scrape.do, con interés comercial): 0,50 $ por 1K estándar y 1,00 $ por 1K con proxies premium o JavaScript.

Veredicto provisional: el coste real depende de la configuración; no se puede dar un precio por 1.000 páginas sin medir con la cuenta.

### Política de uso (la parte que decide)

Texto de la documentación (`web-scraping-api-introduction`, sección «Usage policy»):

- «Intended for collecting publicly accessible web data.»
- No soporta contenido tras inicio de sesión, información privada de usuarios ni datos restringidos o no públicos.
- «Users are responsible for ensuring their use of the service complies with applicable website terms and internal policies.»

Texto del contrato de licencia (https://decodo.com/legal/license-agreement):

- El cliente es el único responsable del contenido de terceros al que accede, lo guarda y lo conserva con el sistema, y no puede violar las restricciones de quien lo originó, «estén publicadas o no».
- Entre las actividades prohibidas: violar derechos de terceros, incluida la privacidad, los datos personales, los derechos de autor y la propiedad intelectual. Puede haber sanciones civiles, administrativas y penales.
- Se incorpora un Acuerdo de Tratamiento de Datos (DPA) cuando se procesan datos personales.

Conclusión: el proveedor traslada toda la responsabilidad legal sobre el destino a Fresco, aunque lo venda como capaz de saltarse CAPTCHAs.

### Otros datos del proveedor

| Dato | Valor |
|---|---|
| Rendimiento publicado | 99,99 % de éxito, 10 a 200 peticiones por segundo según plan. Es dato del proveedor; no medido |
| Tarifas | 0 $ (10 req/s), 19 $, 49 $, 99 $ y 249 $ al mes |
| Reintentos | Reintenta y no cobra las páginas fallidas, según su página de `/crawl` |
| Salidas | HTML, JSON, CSV, Markdown, capturas |
| Certificación | ISO/IEC 27001:2022 en proxies y Scraping API, según su blog |

## Paso 2. Fuentes candidatas: `robots.txt` y condiciones de uso

El `robots.txt` se descargó una vez por sitio con un agente identificado. No se ha extraído ninguna página de contenido.

| Fuente | Uso previsto | `robots.txt` | Condiciones de uso | Veredicto provisional |
|---|---|---|---|---|
| Mercadona (`www`) | Catálogo y precios | `User-agent: *` con `Disallow:` vacío: todo permitido | Aviso legal: 403 a un cliente automatizado, no leído | Pendiente de lectura por una persona |
| Mercadona (`tienda`) | Catálogo y precios | `Disallow: /` salvo `/product`, `/sitemap.xml`; bloquea `/api` y `/legal` | No leídas (la ruta `/legal` está vetada a rastreadores) | Pendiente; solo `/product` sería rastreable |
| Carrefour | Catálogo y precios | Sin bloque para `*`; 83 reglas `Disallow` solo para agentes con nombre | Aviso legal: 403 a un cliente automatizado, no leído | Pendiente de lectura por una persona |
| Día | Catálogo y precios | `robots.txt` responde 403 «Access Denied» a un cliente automatizado | No leídas | **Descartada**: el sitio bloquea la automatización hasta en su `robots.txt` |
| Cookpad | Recetas | `*` permite casi todo con exclusiones; bloquea con `Disallow: /` a GPTBot, CCBot y ClaudeBot | URL de condiciones no localizada (404) | **Descartada** por la señal explícita contra bots |
| Directo al Paladar | Recetas y fotos | `*` permite casi todo; bloquea MJ12bot, AI2Bot, Diffbot y otros | No localizadas | **Descartada**: contenido editorial con derechos de autor |
| Recetasgratis | Recetas | `*` veta búsqueda, administración y `ajax`; no veta las recetas | URL no localizada (404) | Pendiente; contenido editorial con derechos de autor |
| Wikimedia Commons | Imágenes con licencia | `*` veta `/w/` y `/api/`; `Crawl-delay: 5` para algunos bots | Términos de Uso: obligan a cumplir la User-Agent Policy, la Robot Policy y API:Etiquette | **Viable por su API oficial** con User-Agent identificado, sin necesitar un servicio de scraping. Atribución obligatoria según la licencia de cada archivo |

Observaciones:

- Los dos supermercados que se pudieron consultar responden 403 a un cliente automatizado incluso en su aviso legal, y un tercero lo hace con su `robots.txt`. Esa respuesta es la señal de que no quieren automatización; se respeta, sin usar un navegador o un servicio de desbloqueo para esquivarla.
- Una fuente sin respuesta clara se descarta (criterio de FRESCO-977). Las dos de supermercados quedan en «pendiente de lectura manual», no en «permitidas».
- Para imágenes de comida con licencia no hace falta scraping: Wikimedia Commons tiene API, y ya se usan APIs oficiales (Unsplash, Pexels, Pixabay) en `scripts/fetch-recipe-photos.ts`.

## Dato sobre Tavily (alternativa ya instalada)

Al pedir 8 URLs seguidas de legales tras otras ~10 llamadas en pocos minutos, `tavily_extract` respondió `429: Your request has been blocked due to excessive requests`. Sirve de comparación: el límite de la cuenta de Tavily es bajo para uso en lotes. Su plan y su cuota no se conocen; hay que consultarlos antes de medir.

## Respuestas provisionales a las seis preguntas

| # | Pregunta | Respuesta hoy |
|---|---|---|
| 1 | ¿Gratuito recurrente o crédito único? ¿Pide tarjeta? | Sin aclarar; las fuentes se contradicen. Solo se sabe creando la cuenta |
| 2 | ¿Qué pasa al agotar el plan gratuito? | Sin documentar en lo leído. Hay que comprobar que se corta y no cobra |
| 3 | ¿Qué funciona sobre las fuentes que nos interesan? | No medido. Además, la mayoría de las fuentes de recetas y supermercados quedan descartadas o pendientes por legalidad |
| 4 | ¿Calidad del dato frente a Unsplash, Pexels y Pixabay? | No medido |
| 5 | ¿Qué parte ya la tenemos? | Tavily ofrece `crawl`, `map`, `extract` y `search`; con límite de cuota bajo |
| 6 | Datos personales o con derechos de autor | Recetas y fotos editoriales: derechos de autor, descartadas. Precios de supermercado: datos públicos, términos sin leer. Sin datos personales en las fuentes elegidas |

## Pendiente (pasos 3 a 6)

- **Necesita OK del fundador**: crear la cuenta de Decodo (acción externa, y la documentación habla de «comprar una prueba gratuita»; confirmar que no hay cobro).
- Lectura manual de las condiciones de Mercadona, Carrefour y Recetasgratis por una persona.
- Muestra pequeña (menos de 100 peticiones), repetida con Tavily y con una alternativa gratuita, solo sobre fuentes con veredicto favorable.
- Medición (porcentaje de páginas bien extraídas, tiempo, coste por 1.000 páginas), informe final y recomendación.

## Referencias

- Post: https://x.com/midudev/status/2110793074356195622
- Producto: https://decodo.com/web-data-api
- Precios: https://decodo.com/scraping/web
- Endpoint de rastreo: https://decodo.com/web-data-api/crawl
- Documentación: https://help.decodo.com/docs/web-scraping-api-introduction y https://help.decodo.com/docs/web-scraping-api-quick-start
- Contrato de licencia: https://decodo.com/legal/license-agreement
- Términos de Wikimedia: https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use
- Comparativas de terceros (con sesgo comercial): https://scrape.do/blog/best-web-scraping-api
