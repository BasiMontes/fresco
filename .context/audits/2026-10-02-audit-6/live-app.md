# Audit-6 · Eje "App autenticada en vivo" (rúbrica v1)

Entorno: https://fresco-pre.vercel.app (staging, 2026-10-02). Usuario de prueba **Plan Free** (no Pro). Chrome headless vía playwright-cli, viewports 360/390/768/1280 (+320 en banner y onboarding).
Evidencias: `/private/tmp/claude-501/-Users-basimontes-fresco-fresco-app/5cb745ee-1243-4714-9107-7c4959f7f974/scratchpad/a6/*.png`

## Puntuación: **3,5 / 5** (audit-5 eje: 3/5)

Núcleo sólido (login, generación, calendario, marcar cocinado, lista, logout, gate de /admin, rendimiento, teclado), pero con una capa de precios/enlaces de supermercado poco fiable, una incoherencia de cifras entre pantallas y dos regresiones de responsive (calendario a 768, rejilla de onboarding a 360).

Resumen: 0 BLOCKER · 2 ALTO · 5 MEDIO · 4 BAJO.

## Hallazgos

### A6-L1 · ALTO · Enlaces de supermercado que apuntan al producto equivocado (capa de precios FRESCO-767..771)
Repro: Free, Generar menú, /shopping-list. Los enlaces "Abrir X en Mercadona" resuelven mal:
- "Fideos" (sopa de fideos) enlaza a `fideos-chocolate-hacendado-especial-reposteria-postres`.
- "Nueces" enlaza a `trenza-con-nueces-4-pieza` (bollería).
- "Pechuga de pollo" enlaza a lonchas (fiambre); "Salmón" siempre al ahumado, incluso donde no aplica.
- "Carne picada" enlaza a `preparado-carne-picada-cerdo` con el perfil con dieta **Halal** marcada (ver L6).
Evidencia: `07-shopping.png`. Impacto: el usuario compra algo distinto; el precio estimado se calcula sobre otro producto.
Fix: matching por categoría/tipo de producto con lista de exclusión (repostería, bollería, fiambre) y umbral de confianza; si no hay match fiable, no mostrar enlace ni precio de producto. Respetar dieta (halal/vegano) en el match.

### A6-L2 · ALTO · /calendar desborda horizontalmente a 768px y la flecha pisa la cabecera
Repro: viewport 768, /calendar. `scrollWidth` 884 > 768 (scroll horizontal de página); la flecha "día siguiente" se superpone a "Martes". A 360/390/1280 no hay desborde.
Evidencia: `r-768-calendar.png`. Fix: acotar el contenedor del grid (`min-w-0`, overflow solo en el carrusel) y reservar columna para las flechas en el breakpoint tablet.

### A6-L3 · MEDIO · Cifras contradictorias entre Inicio y Lista de la compra
/menu muestra "Gasto semanal estimado **88,36€**" (a 360px), la lista muestra "Total estimado **40,87–55,30€**" para la misma semana. Antes de generar, /menu mostraba "~45€ / ~15€ / ~3h" fijos (genéricos, no del usuario) con aspecto de dato real.
Fix: una sola fuente de verdad para el estimado; etiquetar claramente los valores de ejemplo o ocultarlos hasta tener menú.

### A6-L4 · MEDIO · Rejilla "Comidas a planificar" del onboarding sigue sin caber a 360px (FRESCO-773)
Repro: /onboarding, paso 3, 360px: se ven LUN..SÁB (SÁB recortado con degradado), **DOM fuera de vista**; la tabla mide 295 px en un contenedor de 270. El commit `1dd701ad` afirma "7 días caben sin scroll a 360px". Nota: puede que staging aún no tenga ese commit (publicado 01-oct 22:36); verificar el SHA desplegado. Evidencia: `11-onb-360-s3.png`.

### A6-L5 · MEDIO · Pantalla de resumen del onboarding no refleja el perfil guardado
Un usuario ya onboarded (perfil real: Halal, alérgeno Huevo, 6 desayunos) que entra en /onboarding ve el wizard vacío y un resumen "Sin restricciones / Ninguno indicado / Toda la semana"; "Empezar" podría pisar sus preferencias. No pulsé "Empezar" (no medido el efecto). Fix: precargar el perfil o redirigir a /profile si ya completó onboarding. Evidencia: `12-onb-summary-360.png`.

### A6-L6 · MEDIO · Menú del perfil Halal incluye cerdo en la lista
"Pastel de carne" (Domingo) se compra como `carne picada cerdo` con dieta Halal activa. No he podido verificar si la receta está etiquetada halal; la lista no respeta la dieta. Relacionado con L1.

### A6-L7 · MEDIO · Menú generado en viernes planifica lunes-jueves ya pasados; la lista de la compra los incluye
Hoy es viernes 2 oct y la semana 28 sep-4 oct tiene Lunes..Jueves con recetas; la lista de la compra suma ingredientes de días ya transcurridos (Sopa de fideos "Lunes", Boniato "Miércoles/Jueves"). Sobrecuenta el total y compra innecesaria. Fix: generar/sumar solo días >= hoy, o ofrecer "planificar la semana siguiente".

### A6-L8 · BAJO · Precios y unidades con formato inconsistente
- Perfil: "Después, **€4.99/mes**" (formato anglosajón) frente a "40,87€" en el resto; en España "4,99 €/mes".
- Lista: "Boniato **1.6 kg**" (punto decimal), "Leche 1 l · **0,00€**" (precio cero visible), "Manzana 5 unidades" sin enlace mientras vecinos sí.
- Ingredientes sin cantidades en la ficha de receta.

### A6-L9 · BAJO · Datos de catálogo
"Porridge de avena con manzana" categorizado como `ensalada`; "Berenjenas asadas con sésamo con semillas de lino" (doble "con"); categorías erróneas en Lista ("Tofu", "Nueces", "Semillas de lino" bajo "Pasta/arroz/legumbres"); "Cerrar sesión" aparece dos veces en /profile.

### A6-L10 · BAJO · Elementos interactivos anidados y objetivos táctiles pequeños
Tarjetas de receta son `<a>` que contienen `<button>` (Cocinado/Descartar, favoritos, arrastrar): nested-interactive (axe). Objetivos <44px: favoritos/notificaciones 36x36, flechas de semana 35x35, checkboxes de la lista 26x26, switch de recordatorios 44x26, 48 elementos <44px en /shopping-list y 54 en /profile a 360px.

### A6-L11 · BAJO · Cookie de sesión sin `httpOnly` ni `Secure` (regresión A5-H8, parte 2)
`sb-<ref>-auth-token`: `httpOnly=false`, `secure=false` (sobre HTTPS), `SameSite=Lax`, caducidad ~1 año, 3117 bytes. También `fresco_nombre` y `fresco_cookie_*` sin flags. Es el comportamiento por defecto de `@supabase/ssr` con cliente de navegador; con CSP enforcing el riesgo se mitiga pero un XSS exfiltra el token. Fix: marcar `secure` en producción/staging y valorar sesión solo-servidor (httpOnly).

## Regresiones comprobadas

| Ítem | Resultado |
|---|---|
| A5-H7 (Pro promete "te recuerda marcar lo que cocinaste") | **Resuelto**: los botones "Cocinado/Descartar" existen en /calendar (toast "Marcado como cocinado" + Deshacer); texto Pro reformulado a "aprende de lo que cocinas y descartas". Hay histórico con "3 cocinadas · 2 descartadas". Nota: Free "se guardan igual, pero no se aplican" |
| A5-H8a (/admin/recipes sin gate de rol) | **Resuelto** para usuario no admin: /admin y /admin/recipes devuelven 404 "Página no encontrada" (sin sesión, redirigen a /login). Rol admin no medido |
| A5-H8b (cookie sin httpOnly) | **Persiste** (ver A6-L11) |

## Positivos

- Rendimiento excelente: /menu LCP 0,94-1,45 s, CLS 0; home LCP 0,25-0,45 s, CLS 0,002; TTFB ~31 ms; 17 KB transferidos en /menu.
- Cero errores/avisos de consola; ninguna petición con fallo (todo 200); Sentry operativo.
- Gate de rol correcto (404 para no admin), rutas privadas redirigen a /login tras cerrar sesión; logout limpia la cookie.
- Banner de cookies: botones Rechazar/Configurar/Aceptar de igual peso, 44 px de alto, dentro de márgenes a 360 y 320 sin desborde; la barra inferior queda por encima del banner (FRESCO-756/757/758 OK). Sin desborde horizontal a 360/390/1280 en menú, calendario, lista, recetas, perfil, histórico.
- Teclado: "Saltar al contenido" primero, orden de tabulación lógico, 0 elementos sin indicador de foco en 30 tabulaciones.
- Tarjeta "Cómo aprenden tus menús" (FRESCO-333) clara, con ejemplo y CTA a Pro; copy en español de España sin voseo.
- Filtro de alérgenos correcto en lo comprobado (alérgeno Huevo: recetas "Sin huevo"; Tarta de manzana sin huevo en ingredientes).
- Estado vacío de /menu con CTA claro; histórico de menús útil; rejilla de onboarding con etiquetas ARIA por checkbox ("Desayuno lunes").

## No medido

- Rol admin real y cuenta Pro (solo Free): gates Pro vs Free por contraste, flujo de prueba gratis, Stripe (prohibido).
- Intercambio (swap) de platos por arrastre y su límite de tasa; "Regenerar".
- Estados de error/carga de /shopping-list forzados (sin simular fallos de red), comparativa por cadena (solo se ofrece Mercadona; no hay otras cadenas visibles).
- Ratio de contraste calculado (solo inspección visual); lector de pantalla real; Lighthouse completo; 390px de /onboarding; efecto de "Empezar" en el resumen de onboarding; enlaces rotos de footer legal (son botones/modales, no navegados).
- SHA desplegado en staging (A6-L4 podría ser por despliegue desfasado).

## Contrato de artefactos efímeros

- `secrets_materialized`: sesión Supabase en memoria del navegador (cookie), sin storageState, HAR ni token en disco; la contraseña no figura en capturas (01-login.png se tomó antes de rellenar). El directorio `.playwright-cli` (logs de comandos) se borró.
- `cleaned: yes` (navegador cerrado, sesión cerrada con logout, sin servidores locales). Efecto en datos: se generó el menú de la semana 28 sep-4 oct de la cuenta de prueba y se marcó/desmarcó un plato como cocinado.
