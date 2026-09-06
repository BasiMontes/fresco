# FRESCO-448 — Pasada de craft con ojo de diseño (auditoría documentada)

Última tarjeta de la épica FRESCO-436. Método: scan determinista `impeccable/detect.mjs` + 4 pasadas live paralelas (playwright-cli, 1280 / 375 / 320px, estados empty·loading·error, micro-estados con Tab, presión: dark emulado · nombres largos · alérgenos) contra `DESIGN.md` v2. Fecha: 2026-09-06.

Satisface el AC **"revisión con impeccable — cada pantalla principal ha pasado al menos una pasada de crítica y corrección documentada"**.

---

## Resumen de triage

| Grupo | Qué | Acción |
|---|---|---|
| **Sistémicos (S1–S9)** | Bugs en primitivas compartidas (`EmptyState`, `Button`, focus rings, scrims, Fraunces 600) que cascadean a 5–8 pantallas cada uno | **Se arreglan en este ticket** |
| **P1 por pantalla** | Rotura o estado sin diseñar concretos | **Se arreglan en este ticket** |
| **Dark mode** | Tema oscuro nuevo (petición del founder en esta sesión) | **Se arregla en este ticket** (commits separados) |
| **P2/P3 cola larga** | Pulido menor, inconsistencias de container width, casing, orphans tipográficos | **Tickets hijos bajo FRESCO-436**, `Relates`-linked |

---

## Hallazgos sistémicos (cascadean — se arreglan aquí)

### S1 — `EmptyState` viola §Elevation y §Typography  ·  P1  ·  clusters A·B·C
`components/ui/empty-state.tsx`
- `bg-surface` (token recesivo) en vez de `surface-raised` → "beige sobre beige" v1, el bug que v2 existe para matar.
- Sin `border border-border` → §Elevation "every card carries the hairline, unconditionally".
- Título `<h2 className="text-h5">` → Fraunces 600 @ 15px = serif negrita minúscula, cero jerarquía, "never bold a Fraunces headline".
- Las páginas en empty no emiten `<h1>` (el título de página vive solo en el estado poblado).
- **Fix:** `surface-raised` + hairline (calca `Card` default); título a elemento no-h1/h2 (lo resuelve S2); opción `as`/slot para el `<h1>` de página.
- **Cascada:** /menu, /calendar, /recipes, /favorites, /shopping-list, /notifications, /historial.

### S2 — Fraunces 600 en headings que no son h1/h2  ·  P1  ·  clusters A·B·C·D
`app/globals.css` regla `h1,h2{font-family:Fraunces}` + utilidades `.text-h3..h6` (que fuerzan `font-weight:600`) usadas sobre elementos `<h2>` → subtítulos serif en negrita, prohibido por DESIGN.md.
- Golpea: título de `EmptyState`, `recipe-detail` "Ingredientes"/"Preparación", `<h1 text-h3>` de todas las pantallas auth, subtítulos de onboarding (pasos 2·3), "Últimas recetas añadidas", "Total estimado" de la lista.
- **Fix (una sola ubicación):** safety-net en `@layer base` — `h1.text-h3, …, h2.text-h6 { font-family: var(--font-body)… }`. El peso 600 ya viene del token. Resuelve todos los casos sin tocar 15 componentes.

### S3 — Contrato de focus ring (FRESCO-443) no es universal  ·  P1  ·  clusters A·B·C·D
Controles sin `focus-visible:ring` propio caen al outline azul del navegador (`1px auto rgb(0,95,204)`) en una UI toda verde/crema.
- Golpea: botones "Cocinado"/"Descartar" del calendario, nav del calendario, chips de preferencias de perfil, grid de planificación, cards de receta (`<Link>`), cards de favoritos, botones internos de `SegmentedControl`, X de `RoutesNotice`, back de notificaciones.
- **Fix (una sola ubicación):** fallback global en `@layer base` — `:where(a,button,input,select,textarea,[tabindex]):focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }`. `:where()` = specificity 0, así que cualquier `focus-visible:ring-*` propio sigue ganando.

### S4 — Halo blanco del `ring-offset`  ·  P3→se cuela aquí  ·  clusters A·C
`--tw-ring-offset-color` default = blanco → halo blanco duro alrededor de inputs/switch/botones enfocados sobre la crema `#FAF3E3`.
- **Fix:** `html { --tw-ring-offset-color: var(--color-background); }` (una línea; también arregla dark).

### S5 — Borde de `Button variant="secondary"` a 1,2:1  ·  P2  ·  clusters C·D
`components/ui/button.tsx:28` — `border-border` (texto al 16% ≈ 1,2:1 sobre crema), bajo WCAG 2.2 SC 1.4.11 (3:1) para el límite de un control. FRESCO-443 subió los inputs a `neutral-600` pero dejó el botón de fondo transparente que *depende* de su borde.
- Golpea: "Cerrar sesión", "Descargar", "Cancelar" en diálogos, "Continuar como invitada", botón de reasignación de signup.
- **Fix:** `border-neutral-600` en el variant `secondary` (calca el contrato del input).

### S6 — Alpha sobre token hex colapsa a transparente  ·  P0/P1  ·  cluster B
El modificador alpha de Tailwind sobre un token con valor hex → transparente (el gotcha que DESIGN.md §Elevation advierte).
- **S6a — sin scrim de backdrop.** `filter-drawer.tsx:133` + `dialog.tsx:164` usan `bg-text/50` → `rgba(0,0,0,0)`. Los modales y el drawer **no tienen atenuación de fondo**. El contenido detrás queda plenamente iluminado y el panel es la misma crema que la página. **P0 para el diálogo** (un modal sin dim está roto).
- **S6b — `tag-allergen` invisible.** `tag.tsx:30` — tinte amber-100 (`#FCF1E8`) sobre crema (`#FAF3E3`) ≈ 0 de contraste, `border-transparent`. La ÚNICA tag que DESIGN.md dice "must stand out for food-safety" ("Pescado", "Soja") se lee como texto flotante sin padding. **P1 seguridad alimentaria.**
- **Fix:** scrim a `bg-black/50` (o token rgba que sobreviva alpha); `tag-allergen` con borde visible + fill más fuerte que clare 3:1 sobre `background`.

### S7 — `color-scheme` sin fijar  ·  P2  ·  clusters B·C
`:root` computa `color-scheme: normal` → bajo SO oscuro, controles nativos (autofill, scrollbars, spinners, `<textarea>` de "Crear propia") renderizan en oscuro UA sobre campos claros.
- **Fix:** lo resuelve el trabajo de dark mode (`app/layout.tsx` stampa `color-scheme` por cookie) + `color-scheme: light` en `:root` como base.

### S8 — Clase `text-body-lg` no existe  ·  P2  ·  cluster C
`shopping-list-view.tsx:467` — el nombre del artículo (la línea de contenido principal de la pantalla) usa `text-body-lg`, que no está en `tailwind.config.ts` ni en `globals.css` → cae al tamaño heredado, sin token.
- **Fix:** usar `text-body-md` (o definir `body-lg` ≥16px). Verificar contra "no bajar los items de la lista de 15px".

### S9 — El campo de contraseña de `/signup` es más débil que el de onboarding  ·  P1  ·  cluster D
`app/signup/page.tsx:460` usa un `Input` pelado (sin ojo mostrar/ocultar, sin medidor de fuerza, sin pista de política min-10) mientras `/onboarding` "Crear cuenta" usa `PasswordInput` (FRESCO-198). Además `minLength={10}` nativo dispara la burbuja de validación del navegador ("Aumenta la longitud…") en OS, antes de que el `text-error` diseñado renderice.
- **Fix:** `PasswordInput` en `/signup` y `/update-password`; quitar `minLength` nativo (mantener el check JS `isPasswordTooShort`); pista estática "mínimo 10 caracteres".

---

## P1 por pantalla (se arreglan aquí)

| # | Pantalla | Finding | Archivo |
|---|---|---|---|
| P1-a | /calendar | Botones "Cocinado"/"Descartar" son `rounded-md` (no pill) — "Don't square-corner a button" | `components/calendar/calendar-grid.tsx:734,748` |
| P1-b | /recipes (drawer + "Crear propia") | (= S6a) sin scrim | `components/ui/filter-drawer.tsx:133`, `dialog.tsx:164` |
| P1-c | /recipes/[id] | (= S6b) `tag-allergen` invisible | `components/ui/tag.tsx:30` |
| P1-d | /recipes (≤375px) | Campo de búsqueda (acción primaria de Biblioteca) colapsa a ~40–56px sin label ni placeholder, compite con 2 botones no-shrink | `components/recipes/recipe-library.tsx:184-196` |
| P1-e | /profile | Chips de dieta/alérgenos + botones "Todos/Ninguno" sin focus ring (= S3, verificado live `boxShadow:none`) | `components/profile/preferences-form.tsx:269-303` |

---

## P2 / P3 — cola larga → tickets hijos bajo FRESCO-436

Se crean como historias/tech-debt hijos `Relates`-linked a FRESCO-448. Agrupados:

### Hijo 1 — Tipografía y kickers (P2/P3)
- Section headings `<h2 text-h3>` en /menu, dialog de borrado del calendario → Figtree (parcialmente cubierto por S2, resto es elección de elemento).
- Kicker inconsistente: /favorites y /notifications usan `text-body-sm uppercase` en vez del token `text-h6` (12px/0.08em). /historial sin kicker.
- Casing de tags inconsistente (lowercase en notifications vs Title-case en perfil).
- Orphan de "." en la frase de términos de signup (≥768px).
- Nombres de receta con conector roto ("con y limón") en /historial — bug de generación de datos.

### Hijo 2 — Responsive 320–375px (P2/P3)
- /notifications: h1 "Centro de Avisos" colisiona con back button a 375/320.
- /profile: plan `Tag` "Plan Free" wrappea dentro del pill a 320px; grid de planificación con `overflow-x-auto` corta SÁB/DOM sin affordance.
- /recipes: "Crear propia"/"Filtrar y ordenar" wrappean a 2 líneas dentro del pill.
- /menu: "Últimas recetas añadidas" + "Ver todas" colisionan a mobile.
- /login: logo clipado ~2px a 320px (el truco `absolute` de FRESCO-269 es vestigial, todas las auth están top-anchored ahora).
- onboarding paso 3: grid de planificación requiere scroll horizontal ≤375px.

### Hijo 3 — Estados sin diseñar / consistencia de patrón (P2/P3)
- Slot vacío del calendario ("Sin receta"/"Excluida por ti") = caja bordeada grande con una línea itálica arriba; sin placeholder diseñado.
- `RecipePlaceholder` a tamaño hero (`/recipes/[id]`) lee como imagen rota — gradiente muy plano, inicial `text-neutral-500`.
- `/forgot-password` estado enviado: mantiene subtítulo original + añade párrafo casi idéntico; sin afirmación de éxito (icono/color).
- `/update-password` estado link inválido: h1 "Elige una nueva contraseña" sin campo; link de recuperación sin subrayar.
- Back-affordance inconsistente en el cluster notifications/historial/profile.
- Falta `LegalLinks` en /forgot-password y /update-password.
- No hay skeleton dedicado para /recipes ni /recipes/[id] (solo `opacity-60`).

### Hijo 4 — Densidad y restraint (P2/P3)
- /recipes/[id]: fila de tags satura (hasta 9 pills wrapeando 2–3 filas bajo el h1) — cap a 3 + "+N".
- onboarding paso 2: ~25 pills `tag-outline` verdes = muro verde que pelea con la tesis casi-monocroma → `tag` hairline para no seleccionados.
- /menu: strip de stat-tiles con `gap-8` (35px) → los 4 hairlines se leen como 4 guiones flotantes en vez de "una unidad dividida por hairlines" (FRESCO-444).
- /menu: flecha de `HorizontalScrollRow` solapa la 3ª card / se clipa en el borde del container.
- Checkbox de términos de signup es círculo (`rounded-full`, lee como radio) vs cuadrado 4px en onboarding → estandarizar `rounded-sm` 6px.
- /recipes vs /favorites: container width distinto (`max-w-5xl` vs `max-w-3xl`).
- `SegmentedControl`: botones internos sin focus ring (parcialmente S3).
- Cards de receta sin hover affordance (`transition:all` puesto pero nada transiciona; token "Card hover tilt" sin usar).

### Hijo 5 — Micro-detalles (P3)
- Focus offset blanco (= S4, se arregla aquí).
- Botones disabled con `opacity-50` ilegibles sobre crema ("Generando…").
- Hover de mark-buttons del calendario = wash rojo/verde completo dentro de la card.
- Segmentos vacíos de progress-bar / password-strength a ~1,1:1.
- Dropdown triggers de onboarding con glyph unicode `▾` en vez del icono de línea.
- Saludo "Hola" pelado (sin coma ni nombre) cuando `nombre` es null.
- Spacing off-grid contra el sistema 4.4px (`gap-1.5`, `py-2.5`, `size-2`).
- "Borrar todo" siempre visible en el drawer aunque no haya filtros activos.
- FAB "Compra realizada" con `shadow-lg` (reservado a overlays); `ReceiptTicket` con `rounded-3xl`/`rounded-xl` raw en vez de tokens.

---

## No testeable en local (limitaciones)

- **Estados poblados** de /menu (meal grid), /calendar (7×3 grid real, drag-and-drop, truncado de nombre 40+ en grid, `AlertBanner` advertencias, pill naranja "hoy"), /shopping-list (default + recibo): `generate-meal-plan` rechaza el origin de localhost (CORS — el allowlist de la edge function no tiene el origin de dev; ver memoria `project_edge_cors_allowlist_manual`). Revisados solo por código + `/dev/skeleton-capture`.
- **/signup** paso OTP, reasignación, pending-confirmation; **/onboarding** generando/éxito; **/update-password** happy path + mismatch: requieren email round-trips / sesión de recovery real. Revisados por código.
- Dark emulado (`prefers-color-scheme: dark`): sin rotura en ninguna pantalla — la app era light-only, todo tokens, sin `dark:` variants, sin controles nativos sin estilar. El tema oscuro real se construye en este ticket.

### Corrección de premisa del brief
FRESCO-263/265 (presupuesto obligatorio) fue **revertido** por FRESCO-371 (A4-H14): el presupuesto es opcional, el paso 3 lo etiqueta "(opcional)" y solo soft-valida > 0. Comportamiento correcto, no defecto.
