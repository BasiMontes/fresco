# Auditoría UX 2026-10-12 — 05 (PARCIAL: solo zona pública)

> **Estado: INCOMPLETA.** El login en staging (`https://fresco-pre.vercel.app/login`) exige Cloudflare Turnstile. En navegador automatizado la verificación devuelve «La verificación falló» y el botón «Iniciar sesión» queda deshabilitado. Según las reglas de la tarea (si falla el login, parar y avisar) no se ha recorrido la zona autenticada: menú, calendario, recetas, favoritos, lista de la compra, notificaciones, perfil, Pro/checkout, historial. No se ha intentado saltar la protección anti-bot.
>
> Cubierto: landing, login, registro, recuperar contraseña, onboarding (pantalla de entrada), páginas legales, sobre nosotros, 404, enlace de nueva contraseña caducado. Viewports 1440 y 393 (768 solo en landing). Método: auditoría DOM (tap targets, labels, desbordes, encabezados) + capturas revisadas a mano.

## Resumen

| Severidad | Nº |
|---|---|
| ALTO | 1 |
| MEDIO | 6 |
| BAJO | 5 |
| Total | 12 |

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

## Lo que está bien (no tocar)

- Landing, login, registro y legales: sin desbordamiento horizontal a 393 ni 1440, un único `h1`, `lang="es"`, enlace «Saltar al contenido», `alt` en todas las imágenes.
- 404 con título propio; precios coherentes; cookie banner con Rechazar al mismo peso que Aceptar.

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
6. **Pendiente de auditar** (con sesión autenticada, ver nota inicial): todo el producto tras el login.

## Pendiente para completar

Opciones para desbloquear: usuario de staging con Turnstile en modo test (claves de prueba de Cloudflare en el entorno `staging`), o sesión ya iniciada que se pueda adjuntar con `playwright-cli attach`. Capturas en el scratchpad de la sesión (no en el repo).
