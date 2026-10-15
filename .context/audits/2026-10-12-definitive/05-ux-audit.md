# Auditoría UX 2026-10-12 — 05 (zona pública y zona con sesión)

> **Estado: COMPLETA para pantallas** (FRESCO-941, 2026-10-15). La primera pasada (2026-10-12) cubrió solo la zona pública porque Turnstile bloqueaba el login automatizado en staging; no se intentó saltar la protección. La zona con sesión se audita ahora con sesiones minteadas por la API de administración (`E2E_SESSION_LOGIN`, FRESCO-799), sin pasar por el formulario ni por el captcha. Los límites de lo que sigue sin cubrirse están en «Pendiente para completar».
>
> Primera pasada: landing, login, registro, recuperar contraseña, onboarding (pantalla de entrada), páginas legales, sobre nosotros, 404, enlace de nueva contraseña caducado. Viewports 1440 y 393 (768 solo en landing). Método: auditoría DOM (tap targets, labels, desbordes, encabezados) + capturas revisadas a mano.
>
> Segunda pasada (con sesión, UX-13 a UX-28): menú, calendario, recetas y detalle, favoritos, lista de la compra, notificaciones, perfil, historial, con una cuenta Pro de prueba y una Free (menú, perfil y recetas), a 1440, 768 y 393 px, en tema claro y oscuro: 70 auditorías de página en `fresco-pre`. Método: auditoría DOM (desbordes, `h1`, saltos de encabezado, objetivos táctiles, texto menor de 12 px, controles sin nombre, imágenes sin `alt`), axe (`wcag2a`, `wcag2aa`, `wcag22aa`, solo impacto serio o crítico), errores de consola y peticiones fallidas; y capturas revisadas a mano (una selección de 13; ver «Pendiente para completar»).

## Resumen

| Severidad | Nº |
|---|---|
| ALTO | 1 |
| MEDIO | 14 |
| BAJO | 13 |
| Total | 28 |

| ID | Pantalla | Sev. | Esfuerzo |
|---|---|---|---|
| UX-01 | Login | ALTO | M |
| UX-02 | Login/Registro | MEDIO | S |
| UX-03 | Login/Registro | MEDIO | S |
| UX-04 | Landing (móvil) | MEDIO | S |
| UX-05 | Landing (precios) | MEDIO | S |
| UX-06 | Onboarding | MEDIO | S |
| UX-07 | Pie de auth | MEDIO | M |
| UX-08 | Enlaces en línea | BAJO | S |
| UX-09 | Landing (scroll-reveal) | BAJO | M |
| UX-10 | Nueva contraseña | BAJO | S |
| UX-11 | Registro | BAJO | S |
| UX-12 | Cookies legal | BAJO | S |
| UX-13 | Todas (con sesión) | MEDIO | S |
| UX-14 | Lista de la compra, Perfil | MEDIO | S |
| UX-15 | Todas (primera visita, móvil) | MEDIO | M |
| UX-16 | Calendario, Avisos, Perfil | MEDIO | S |
| UX-17 | Perfil | MEDIO | S |
| UX-22 | Calendario (escritorio) | MEDIO | M |
| UX-23 | Calendario | MEDIO | S |
| UX-28 | Menú y nav (768) | MEDIO | M |
| UX-18 | Perfil (móvil) | BAJO | S |
| UX-19 | Perfil | BAJO | M |
| UX-20 | Lista de la compra | BAJO | S |
| UX-21 | Biblioteca, Menú, Lista | BAJO | S |
| UX-24 | Menú, Calendario, Avisos | BAJO | S |
| UX-25 | Detalle de receta | BAJO | S |
| UX-26 | Menú, barra lateral | BAJO | S |
| UX-27 | Calendario, Avisos | BAJO | S |

## Hallazgos por recorrido

### Acceso (login / registro)

**UX-01 — Turnstile bloquea el login sin explicación y con salto de layout** · /login · 1440 y 393 · ALTO
- Observado: el widget aparece solo tras rellenar correo y contraseña, empuja el botón hacia abajo (CLS) y el botón sigue deshabilitado sin mensaje. Si la verificación falla («La verificación falló / Solución de problemas») no hay texto propio de Fresco que diga qué hacer. Heurísticas 1, 5 y 9.
- Esperado: reservar el alto del widget desde el principio, o mostrarlo en modo invisible/gestionado, y un texto de apoyo («Completa la verificación para continuar») más un reintento claro.
- Fix: reservar `min-height` del contenedor Turnstile y añadir mensaje bajo el botón cuando está deshabilitado por captcha. Esfuerzo M. Puntero: `app/login/page.tsx` (~L81, token Turnstile por petición, FRESCO-799).

**UX-02 — Botón principal deshabilitado y casi ilegible; no dice por qué** · /login, /signup · MEDIO
- Observado: el botón vacío es verde apagado con texto blanco de bajo contraste. Con correo mal formado («noesuncorreo») y contraseña corta no aparece ningún error, solo permanece deshabilitado (sin `role=alert` ni `aria-invalid`).
- Esperado: botón siempre activo con validación al enviar/al salir del campo, o error en línea por campo. Los controles deshabilitados quedan fuera de WCAG 1.4.3, pero aquí es el único CTA de la pantalla.
- Fix: validar en `onBlur`, mostrar texto de error asociado con `aria-describedby`. Esfuerzo S.

**UX-03 — Etiquetas solo como placeholder** · /login, /signup · MEDIO
- Observado: «Correo electrónico» y «Contraseña» son el placeholder; al escribir desaparece la etiqueta visible. Login sin botón de mostrar contraseña (registro sí lo tiene). Heurística 6 (reconocer antes que recordar), WCAG 3.3.2.
- Fix: etiqueta visible persistente (o flotante) y ojo «mostrar contraseña» también en login. Esfuerzo S.

**UX-11 — Pista «Mínimo 10 caracteres» demasiado pequeña** · /signup · BAJO
- Observado: texto de ~11 px bajo el campo, detectado como <12 px en la auditoría.
- Fix: 13 px (token `body-sm`) y mostrarla también al enfocar. Esfuerzo S.

**UX-07 — Pie legal de login/registro/onboarding son botones (modales), no enlaces** · /login, /signup · MEDIO
- Observado: «Términos · Privacidad · Contacto · Cookies» son `button`, no `a`; no se pueden abrir en pestaña nueva, ni compartir, ni indexar. Coincide con el ticket 493 conocido (legales solo en modal). Existen rutas `/legal/*` reales.
- Fix: usar `<a href="/legal/...">` y dejar el modal como mejora progresiva. Esfuerzo M. Puntero: footer de auth en `app/login`, `app/signup`.

**UX-10 — Enlace de nueva contraseña caducado: sin encabezado ni acción primaria** · /update-password sin sesión · BAJO
- Observado: solo un párrafo rojo con enlace «recuperar contraseña»; 0 `h1`. El enlace mide 124×15 px.
- Fix: `h1` «Este enlace ha caducado» + botón «Pedir un enlace nuevo». Esfuerzo S. Puntero: `app/update-password/page.tsx`.

### Primera vez / onboarding

**UX-06 — «Continuar como invitada» con género y aspecto de desactivado** · /onboarding · MEDIO
- Observado: el botón secundario tiene texto gris pálido (parece deshabilitado) y usa femenino fijo. Las dos casillas legales (14 años, términos) gobiernan también el modo invitado, sin indicarlo. Además el título «¿Cómo quieres empezar?» no explica qué se pierde sin cuenta más allá de la nota de 3 días.
- Fix: etiqueta neutra («Probar sin cuenta»), color de texto al menos 4,5:1, y una línea «Las casillas se aplican a ambas opciones». Esfuerzo S. Puntero: `app/onboarding/page.tsx`.

### Landing

**UX-04 — En móvil desaparece «Empezar gratis» de la cabecera** · / · 393 · MEDIO
- Observado: la cabecera móvil solo muestra «Ya tengo cuenta» + hamburguesa; el CTA principal queda dentro del menú. El hero sí lo repite, pero al hacer scroll por precios/FAQ no hay CTA visible fija.
- Fix: mostrar «Empezar gratis» compacto en cabecera móvil o barra CTA fija tras el hero. Esfuerzo S.

**UX-05 — Etiquetas en inglés en precios y tono mixto** · / (#pricing) · MEDIO
- Observado: «FREE», «PRO», «POPULAR» en un producto es-ES. El resto usa «Gratis» (CTA «Empezar gratis»). El ahorro anual (44,99 €, «ahorras 14,89 €») es correcto (4,99×12−44,99).
- Fix: «GRATIS» / «PRO» / «MÁS ELEGIDO». Esfuerzo S.

**UX-09 — Secciones ocultas hasta hacer scroll (scroll-reveal)** · / · todos · BAJO
- Observado: una captura de página completa deja en blanco todo entre «El problema real» y el pie; el contenido solo aparece al desplazarse. Riesgo con `prefers-reduced-motion`, lectores de pantalla sin scroll, impresión y previews. No verificado con reduced-motion activado.
- Fix: revelar con CSS que degrade a visible (`@media (prefers-reduced-motion)` y `noscript`). Esfuerzo M.

**UX-08 — Objetivos táctiles < 24 px en enlaces en línea** · varias · BAJO
- Observado (altura): «Inicia sesión» 15 px (signup), «Volver a iniciar sesión» 15 px, «recuperar contraseña» 15 px, «Política de privacidad» 15 px (landing, pie), enlace de correo en contacto 18–23 px, «Términos de Servicio» 20 px. Incumple WCAG 2.2 2.5.8 salvo excepción de enlaces en línea; los aislados («Volver a iniciar sesión», pie) sí cuentan.
- Fix: `padding-block` o `min-height: 24px` (idealmente 44 px en móvil) en enlaces autónomos. Esfuerzo S.

**UX-12 — Texto <12 px en /legal/cookies** · BAJO
- Observado: 4 elementos con fuente <12 px (probable tabla de cookies).
- Fix: mínimo 13 px, tabla con scroll horizontal controlado. Esfuerzo S. Puntero: `app/legal/cookies/page.tsx`.

### Zona con sesión (FRESCO-941, 2026-10-15)

**UX-13 — El título de la pestaña es el mismo en todas las pantallas** · todas · MEDIO
- Observado: las 12 pantallas auditadas devuelven `document.title` = «Fresco — Planificador de menús semanales», sin distinguir Menú, Calendario, Recetas, Lista, Perfil, etc. Con varias pestañas, en el historial del navegador y para un lector de pantalla no se sabe dónde se está. WCAG 2.4.2.
- Fix: título por pantalla («Calendario · Fresco»), con `metadata.title` por ruta. Esfuerzo S. Puntero: `app/(app)/*/page.tsx`.

**UX-14 — Texto de 11 px en la lista de la compra y el perfil** · /shopping-list, /profile · MEDIO
- Observado: 35 elementos en la lista (el aviso de precios, la línea de recetas de cada artículo, el resumen) y 29 en el perfil (el selector de días «Lun, Mar…» y «Todos / Ninguno»). La línea de recetas se corta con puntos suspensivos en móvil («…Jueves), Potaj…»), así que además de pequeña pierde información.
- Fix: mínimo 12 px (13 px el contenido útil) y permitir que la línea de recetas ocupe dos líneas. Esfuerzo S.

**UX-15 — En la primera visita el banner de cookies tapa casi un cuarto de la pantalla móvil** · todas · 393 · MEDIO
- Observado: el banner fijo ocupa unos 190 px de 852 en cada pantalla hasta que se elige una opción. En `/menu` deja a la vista solo la cabecera y las dos cifras; la primera comida queda debajo del banner y de la barra inferior flotante. Es bueno que Rechazar, Configurar y Aceptar tengan el mismo peso.
- Fix: versión compacta en móvil (una línea y botones en fila) o plegar «Más información». Esfuerzo M.

**UX-16 — Objetivos táctiles de 20 px en acciones de cierre y enlaces** · /calendar, /notifications, /profile · MEDIO
- Observado (axe `target-size`, impacto serio en `/notifications` en las 6 combinaciones): «Descartar aviso» 20×20, «Cerrar» el aviso de ayuda del calendario 20×20, «Ver semanas anteriores» (158×20) y «Ver histórico completo» (329×20). WCAG 2.2 2.5.8.
- Fix: `min-height` y `min-width` de 24 px como mínimo (44 px en móvil) con `padding` en estos controles. Esfuerzo S.

**UX-17 — El campo «Tu nombre» no tiene etiqueta asociada** · /profile · MEDIO
- Observado: `input[nombre_input]` sin `label`, `aria-label` ni `aria-labelledby`; solo un placeholder («¿Cómo te llamamos?») y un encabezado cercano. Es el único control sin nombre accesible de todo el recorrido. WCAG 1.3.1 y 3.3.2.
- Fix: `label` visible o `aria-labelledby` apuntando al encabezado «Tu nombre». Esfuerzo S.

**UX-22 — En escritorio el calendario muestra 3 de 7 días y deja espacio sin usar** · /calendar · 1440 · MEDIO
- Observado: la cuadrícula enseña Lunes, Martes y Miércoles; el resto está detrás de dos flechas de día que quedan a la altura de los títulos de columna, lejos de las flechas de semana de la cabecera (dos pares de flechas con funciones distintas). A la derecha de la cuadrícula quedan unos 180 px vacíos dentro de la columna de contenido.
- Fix: dejar que la cuadrícula use todo el ancho disponible para mostrar más días a 1440, y agrupar o diferenciar claramente las dos navegaciones. Esfuerzo M.

**UX-23 — Acción destructiva sin etiqueta visible junto a la navegación de semana** · /calendar · MEDIO
- Observado: una papelera roja de icono solo, con el mismo tamaño y posición que las flechas de semana, a un lado. No he comprobado si pide confirmación ni qué borra exactamente (la semana entera, según el contexto).
- Fix: etiqueta visible o menú de acciones, y confirmación indicando qué se borra. Esfuerzo S. A verificar antes de tocar: el comportamiento actual.

**UX-28 — A 768 px la barra lateral fija deja tarjetas de unos 135 px** · /menu · 768 · MEDIO
- Observado: la barra lateral ocupa 256 px de 768 (un tercio) y las tres tarjetas de comida del día quedan de unos 135 px, con títulos cortados («Tostada con salmón…», «Ensalada de manzana con…»).
- Fix: colapsar la barra a iconos por debajo de cierto ancho (ya existe el botón de plegar) o pasar a la barra inferior hasta 1024 px. Esfuerzo M.

**UX-18 — «Cerrar sesión» aparece dos veces en la tarjeta Cuenta del perfil en móvil** · /profile · 393 · BAJO
- Observado: una fila «Cerrar sesión» con icono y, en la misma fila, un botón «Cerrar sesión». Un escenario e2e ya comprueba que en escritorio no se repite; en móvil sí.
- Fix: un único control. Esfuerzo S.

**UX-19 — El perfil es una sola pila de unos 3.200 px que mezcla ajustes, preferencias y cuenta** · /profile · BAJO
- Observado: nombre, notificaciones, tema, dieta, alérgenos, la cuadrícula de comidas a planificar (la parte más larga), ayuda, histórico, suscripción, cuenta y zona de peligro en un solo scroll. Quien solo viene a gestionar la suscripción o a cerrar sesión recorre todo.
- Fix: agrupar en secciones con ancla o pestañas (Preferencias, Suscripción, Cuenta). Esfuerzo M.

**UX-20 — La lista de la compra tiene un icono de carrito solo en algunas filas, sin etiqueta** · /shopping-list · BAJO
- Observado: en 1440 y en 393 el icono aparece en artículos como Calabaza, Espinacas o Pollo y no en Ajo, Apio o Berenjena. No he comprobado qué hace ni por qué solo en algunos; sin etiqueta visible ni explicación el usuario no puede deducirlo.
- Fix: etiqueta o tooltip persistente y, si depende de si el artículo tiene un producto asociado, decirlo. Esfuerzo S. A verificar: la lógica actual.

**UX-21 — Títulos de receta cortados con puntos suspensivos** · /recipes, /menu (768), /shopping-list (393) · BAJO
- Observado: «Calabacín salteado con albahaca y…» en la Biblioteca a 393, y los títulos de las tarjetas de comida del menú a 768.
- Fix: permitir dos o tres líneas en el título. Esfuerzo S.

**UX-24 — Recetas sin foto muestran un recuadro con una inicial, y una foto parece llevar texto superpuesto** · /menu, /calendar, /notifications · BAJO
- Observado: en el calendario de la prueba 4 de 9 platos sin foto (recuadro con «T», «J», «G»); en avisos 2 de 3 recomendaciones. La foto de «Crema de setas con miso» parece llevar texto superpuesto; no verificado con la imagen original.
- Fix: seguir con el trabajo de fotos del catálogo (FRESCO-192) y revisar esa foto. Esfuerzo S.

**UX-25 — Etiquetas de receta con mayúsculas inconsistentes y un «+7» que oculta etiquetas** · /recipes/[id] · BAJO
- Observado: «mediterránea» en minúscula junto a «Vegetariano» y «Vegano»; un chip «+7» esconde siete etiquetas sin forma visible de verlas.
- Fix: capitalización única en los datos o en la presentación, y que «+7» sea desplegable. Esfuerzo S.

**UX-26 — «¡Hola!» y «Sin nombre» cuando no hay nombre** · /menu, barra lateral · BAJO
- Observado: el saludo queda sin nombre y la barra lateral muestra «Sin nombre»; la app no invita a rellenarlo.
- Fix: texto alternativo del saludo y un enlace a «Tu nombre» del perfil. Esfuerzo S.

**UX-27 — Saltos de nivel de encabezado** · /calendar, /notifications · BAJO
- Observado: la auditoría DOM detecta un salto de más de un nivel entre encabezados visibles consecutivos en ambas pantallas (no he anotado qué niveles).
- Fix: revisar la jerarquía o usar estilos en lugar de niveles distintos. Esfuerzo S.

## Lo que está bien (no tocar)

- Landing, login, registro y legales: sin desbordamiento horizontal a 393 ni 1440, un único `h1`, `lang="es"`, enlace «Saltar al contenido», `alt` en todas las imágenes.
- 404 con título propio; precios coherentes; cookie banner con Rechazar al mismo peso que Aceptar.
- Zona con sesión (70 auditorías de página): ninguna pantalla desborda en horizontal a 1440, 768 ni 393; un único `h1` en todas; sin errores de consola ni peticiones fallidas; sin imágenes sin `alt`; axe no encuentra fallos serios de contraste de color en ninguno de los dos temas (solo `target-size`, UX-16).
- Tema oscuro: en las capturas revisadas (menú y lista de la compra) la jerarquía y el contraste se mantienen; no hay inversiones raras ni imágenes que desentonen.
- La mayoría de los controles táctiles en móvil ya supera 44 px (1 de 65 por debajo en la lista, 2 de 75 en el perfil).

## Quick wins (esfuerzo S, alto impacto)

1. UX-05 Traducir FREE/POPULAR.
2. UX-06 Botón invitado: etiqueta neutra + contraste.
3. UX-02 Errores de validación en línea en lugar de botón mudo deshabilitado.
4. UX-03 Etiquetas visibles + mostrar contraseña en login.
5. UX-04 CTA «Empezar gratis» en cabecera móvil.
6. UX-10 Encabezado y botón en enlace caducado.
7. UX-08 Altura mínima de enlaces autónomos.
8. UX-11 Tamaño de la pista de contraseña.

## Backlog priorizado

1. UX-01 (ALTO) Turnstile: reservar espacio + mensajes.
2. UX-02, UX-03, UX-06 (formularios de acceso).
3. UX-07 pie legal como enlaces reales.
4. UX-04, UX-05 (landing).
5. UX-09, UX-08, UX-10, UX-11, UX-12.
6. Zona con sesión, por impacto: UX-22 y UX-28 (adaptación a escritorio y a 768), UX-15 (banner de cookies en móvil), UX-13 (títulos de pestaña), UX-14 y UX-16 (texto y objetivos táctiles), UX-17; después UX-23 y UX-20 tras verificar su comportamiento actual, y los BAJO (UX-18, 19, 21, 24, 25, 26, 27).
7. Quick wins de la zona con sesión (esfuerzo S): UX-13, UX-14, UX-16, UX-17, UX-18, UX-21, UX-25, UX-26, UX-27.
8. Tarjetas de Jira de la zona con sesión (épica FRESCO-869): FRESCO-966 (UX-13), FRESCO-967 (UX-14, UX-21), FRESCO-968 (UX-16, UX-17, UX-27), FRESCO-969 (UX-15), FRESCO-970 (UX-22, UX-28), FRESCO-971 (UX-23, UX-20), FRESCO-972 (UX-18, UX-19, UX-26) y FRESCO-973 (UX-24, UX-25).

## Pendiente para completar

El desbloqueo se resolvió con sesiones minteadas (ver nota inicial), no con claves de prueba de Turnstile: el captcha es un ajuste de todo el proyecto de Supabase y los tres entornos comparten proyecto. Capturas y datos de las dos pasadas en el scratchpad de la sesión (no en el repo).

Sin cubrir en la segunda pasada, por si se quiere una tercera:
- **Interacciones:** arrastrar y soltar en el calendario, diálogos (borrar cuenta, confirmaciones), menús y estados de error o carga; solo se auditó el estado en reposo de cada pantalla.
- **Pro y pago:** el flujo de suscripción y el checkout de Stripe, y la vista de una cuenta con prueba gratuita o pago fallido.
- **Otras pantallas:** `/onboarding` con sesión, `/admin/recipes` y `/qa`.
- **Revisión visual:** se miraron 13 capturas de las dos pasadas (menú, calendario, lista de la compra, perfil, avisos, Biblioteca y detalle de receta; el tema oscuro solo en menú y lista de la compra); el resto, incluidas las de 768 salvo el menú y las de favoritos e historial, se cubrió solo con la auditoría DOM y axe.
- **Datos:** una sola cuenta de prueba por plan, con un menú generado y sin favoritos ni historial largo; una cuenta con mucho uso puede mostrar otros problemas.
- **Dos hallazgos por verificar antes de actuar:** UX-20 (qué hace el carrito) y UX-23 (qué borra la papelera y si confirma).
