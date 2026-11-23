# Auditoría 10 - pasada de madurez del proyecto (agentic-audit, subject=dev, lens=internal)

Versión en español de `consolidated.md`. Si difieren, manda el original en inglés.

Fecha: 2026-11-23. Objetivo: este repositorio en `8d81367d` (`main`, `staging` y `dev` niveladas). Rúbrica: `agentic-audit v1`, `references/rubric-dev.md`, copia local de la skill con fecha 2026-11-22 (la misma que usó la auditoría 9; no se volvió a comprobar su commit upstream). Modelo: Opus 5.5, esfuerzo `xhigh`, elegido por el dueño para esta pasada.

## 0. Qué es esta pasada y qué no es

Igual que la auditoría 9, esta pasada puntúa la **madurez del proceso frente a la arquitectura agentic-dev** en seis ejes. No es una auditoría de seguridad, pagos, alérgenos ni privacidad, aunque sí leyó el asesor de seguridad de Supabase alojado (sección 4).

Cadencia (la exigen las secciones 1 y 2 de `audit-process.md`): el dueño pidió la pasada regular el 2026-11-23, adelantada desde aproximadamente el 2026-12-03. Corre **un día después de la auditoría 9**, así que el delta que puede medir son las nueve cards de la 9 más una historia (FRESCO-1269), no un mes de trabajo. Casi todo lo nuevo de abajo es profundidad, no cambio: esta pasada leyó cosas que la 9 no leyó. No hay ninguna épica de remediación abierta (FRESCO-986 está `Finalizada`; las abiertas son de producto, mantenimiento y la aparcada FRESCO-1261), así que la sección 2 permite crear una nueva para las cards de esta pasada cuando el dueño las decida. Si el dueño cuenta esta pasada como la regular, la siguiente regular cae hacia el 2026-12-23.

Conflicto de intereses: quien audita es la misma familia de agente que escribió buena parte de este repositorio y que, en esta misma sesión, entregó y cerró FRESCO-1269. El hallazgo F6 trata de ese ticket. Pesa el eje 6 en consecuencia.

## 1. Puntuaciones

| # | Eje | Auditoría 10 | Auditoría 9 | Por qué se movió |
|---|---|---|---|---|
| 1 | Fundación | **4.0** | 4.5 | Profundidad, no regresión: el glosario y la ADR-0001 contradicen ahora lo entregado (F2, F3), y los mapas canónicos son un placeholder o van un mes por detrás (F4). La auditoría 9 comprobó una sola frase del glosario |
| 2 | Backlog | **4.0** | 3.8 | F1, F2 y F5 de la 9 están cerrados. Las historias llevan criterios; los artefactos de secuenciación están congelados en la espina del MVP (F8) |
| 3 | Trazabilidad | **4.7** | 4.5 | 168 de 168 commits de código en 30 días llevan clave y PR; 50 de 50 despliegues de producción salieron de un SHA de `staging` en verde |
| 4 | Arquitectura | **4.5** | 4.5 | Sin cambios. Por primera vez se leyó en vivo el asesor de seguridad alojado y cada aviso resulta intencionado (F7) |
| 5 | Verificación | **4.5** | 4.7 | La puerta de CI es tan fuerte como antes. Novedad: ningún agente puede validar una pantalla autenticada en un entorno desplegado (F5) |
| 6 | Disciplina del agente | **4.3** | 4.5 | El procedimiento de credenciales de la UI en vivo escribió una contraseña en disco durante esta pasada (F1), y hoy se cerró un defecto sin dos de sus puertas de cierre (F6) |
| | **Global (media simple)** | **4.3** | 4.4 | |

Misma rúbrica, mismo lens y misma familia de agente que la auditoría 9, pero con una lectura más profunda de los ejes 1 y 6. El `README.md` ya avisa de que la tendencia se mide por hallazgos cerrados, no por la nota. Con ese criterio, los nueve hallazgos de la auditoría 9 están cerrados o aceptados (sección 3).

## 2. Hallazgos, ordenados por retorno del esfuerzo

La severidad mide el coste para el método del propio proyecto. No hay hallazgos BLOQUEANTES.

### F1. El procedimiento de login de la UI en vivo escribe la contraseña en el árbol del repo (Disciplina del agente, MEDIA, problema real)

`live-ui-validation.md` sección 3.3 dice que `--raw fill <ref> "$VAR"` es la única forma de teclear una credencial. Ese flag oculta solo el eco del comando de relleno. En esta pasada, el siguiente `playwright-cli click` (el botón de login) escribió un snapshot automático en `.playwright/output/page-2026-11-23T17-25-35-467Z.yml`, y ese snapshot contenía el email y la contraseña de la cuenta Free de prueba en texto plano. El subagente lo borró unos tres minutos después. Lo volví a comprobar con un escaneo `varlock` que solo cuenta y no imprime valores: 0 apariciones de cualquiera de las seis contraseñas de prueba en `.playwright/`, en el directorio temporal y en la transcripción del subagente. El valor nunca llegó a la salida de una herramienta. La carpeta está en el `.gitignore`, pero el contrato de artefactos efímeros (`agent-orchestration-detail.md`) prohíbe material de sesión incluso en rutas ignoradas del repo.

Arreglo (barato): en la sección 3.3, enviar el formulario con `run-code` (que no escribe snapshot), prohibir `snapshot` o `click` mientras haya campos de credencial rellenos y añadir un escaneo de solo recuento de `.playwright/output` tras cada login. Alcance de la regla: tiene que llegar a la referencia, a `## Compact Rules` de `sprint-development` y al componente 7 del briefing, no solo a la referencia.

### F2. Las preferencias blandas Pro invierten el razonamiento de la ADR-0001 sin registro de decisión (Fundación, MEDIA, pregunta)

`ADR-0001-behavioral-learning-moat.md:18` llama a la personalización por preferencias declaradas ("cuisines, dislikes, spice level") "table stakes" y la descarta como puerta de Pro: el foso es la señal cocinada/descartada. Entre el 2026-11-17 y el 2026-11-18, FRESCO-1226, FRESCO-1227 y FRESCO-1232 entregaron cocinas favoritas, objetivo y nivel de cocina como preferencias blandas **solo Pro** en la generación de menús. La interfaz lo dice: `components/onboarding/onboarding-step-identity.tsx:44`, "Con Pro, tu objetivo inclina el menú hacia lo que buscas." El glosario sigue prohibiendo ese enfoque (`domain-glossary.md:108`: "preferences" usado sin precisión para la propuesta de valor Pro). Ninguna ADR posterior a la ADR-0070 (2026-11-11), ninguna entrada del SRS y ninguna fila del glosario mencionan el cambio.

Pregunta para el dueño: ¿es un reposicionamiento deliberado de lo que vende Pro? Si lo es, hay que escribir la ADR-0071 que enmiende la ADR-0001 (la alternativa que rechazó queda ahora en parte adoptada, y por qué) y añadir al glosario una fila para "preferencia blanda". Barato.

### F3. El glosario y el SRS dicen que no hay rol de admin, y lo hay (Fundación, BAJA)

`domain-glossary.md:30` y `.context/SRS/architecture.md:187` dicen que no hay "ninguna distinción `admin`/`user`". El código tiene una lista blanca de admin (`ADMIN_USER_ID`, FRESCO-237) en `lib/auth/is-admin.ts` y `supabase/functions/_shared/admin.ts`, y protege `app/(app)/admin/recipes/page.tsx` con `notFound()` para todos los demás. Es un diseño sólido (sin columna `is_admin`, comprobación en servidor), solo que no es el que describen los documentos. Arreglo: una frase en cada fichero.

### F4. Los mapas de negocio canónicos son un placeholder o van un mes por detrás (Fundación, MEDIA, más esfuerzo)

- `bun run context:map business-api-context` responde: "holds a PLACEHOLDER map: nothing has been generated yet". El único mapa de API real es el `.context/business/business-api-map.md` heredado (2026-10-20), que `cli/lib/context-maps.ts:46` marca como legacy.
- `business-feature-map.html` se generó el 2026-10-30. Desde entonces han llegado a `main` 38 commits `feat`, entre ellos las preferencias Pro, la comparación de precios de supermercado (FRESCO-1222), los selectores con pasos y las sugerencias del onboarding (FRESCO-1225, FRESCO-1228) y el tour de primera visita (FRESCO-1197). El mapa no menciona ningún ticket FRESCO-12xx.
- `.context/SRS/functional-requirements.md` y `api-contracts.md` se tocaron por última vez el 2026-08-29.
- `docs/boilerplate.md:322-324` sigue apuntando los comandos de los mapas a las rutas `.md` heredadas.

Coste: una historia que lee la sección de su mapa para situarse recibe el producto de octubre. Arreglo: ejecutar `project-context` en los modos `api` y `features`, y luego retirar las copias `.md` heredadas o marcarlas como sustituidas.

### F5. Ningún agente puede comprobar una pantalla autenticada en un entorno desplegado (Verificación, MEDIA, estructural)

Desde FRESCO-799 (2026-10-05), Supabase Auth alojado exige un token de Turnstile en cada inicio de sesión con contraseña, venga del formulario `/login` o de la API. En esta pasada, las dos identidades, la Free (`PRE_USER_*`) y la Pro (`PRE_PRO_PLAN_USER_*`), se detuvieron en un desafío interactivo en `fresco-pre`: el token seguía vacío a los 20 y a los 40 segundos. La suite e2e entra por `tests/session-login.ts`, que usa un `generate_link` con service-role y está documentado como infraestructura de pruebas para CI. `live-ui-identity.md` sección 3 prohíbe a los agentes justo ese camino, y con razón. Y como `staging` y producción comparten un único proyecto de Supabase (ADR-0020), una clave de prueba de Turnstile solo en el despliegue de `staging` fallaría en la verificación del servidor. `live-ui-validation.md` no menciona el captcha, así que una comprobación de UI en vivo de `/sprint-development` en `staging` choca con este muro sin aviso. Dos auditorías seguidas quedan ciegas en la mitad autenticada.

Opciones, todas a decidir por el dueño: una sesión con ventana en la que el dueño marca la casilla y el agente continúa (barato, pero hace falta en cada ejecución); nombrar el stack local (sin captcha) como el lugar autorizado para las comprobaciones de UI autenticadas y decirlo en la sección 3; o aceptar por escrito el punto ciego.

### F6. FRESCO-1269 se cerró hoy sin dos de sus puertas de cierre (Disciplina del agente, BAJA, problema real)

Este agente cerró FRESCO-1269 como `Finalizada` el 2026-11-23 tras la promoción a `main`. `.context/backlog/definition-of-done.md:36` pide de un defecto que "la reproducción se reprodujo y deja de ser reproducible tras el arreglo", y que `root_cause` esté rellena al cerrar. El arreglo tiene tests unitarios en la misma PR, pero nadie volvió a ejecutar la reproducción tarjeta contra aviso en un entorno desplegado (F5 bloqueó el intento en esta pasada), y `root_cause` está vacía. Es el único de los 15 defectos desde el 2026-10-15 sin ninguno de los dos campos. Arreglo: rellenar `root_cause` y verificar la reproducción en `staging` (requiere F5), o devolver el ticket a `Merged` hasta que alguien lo haga.

### F7. Los avisos del asesor de Supabase son correctos, pero nada lo deja registrado (Arquitectura, BAJA)

Leído hoy en vivo (primera vez que una pasada lee la configuración alojada): 29 WARN y 17 INFO.

- **11 funciones `SECURITY DEFINER` ejecutables por `authenticated`.** Cada una filtra por `auth.uid()`, y `anon` no puede ejecutar ninguna (`pg_get_functiondef` y `has_function_privilege`, solo lectura).
- **16 avisos de inicio de sesión anónimo.** Son políticas del modo invitado limitadas a las filas del propio usuario, más dos tablas de `cron` gestionadas por Supabase.
- **Protección contra contraseñas filtradas.** Requiere Supabase Pro; `lib/validation/pwned-password.ts` lo cubre en la app.
- **17 tablas con RLS y sin política.** Todas son tablas solo para service-role, como está documentado, por ejemplo `stripe_webhook_events` en el mapa de datos.

Todo es intencionado y nada consta como aceptado, así que cada pasada y cada agente que ejecuta `get_advisors` lo vuelve a investigar, como hizo esta. Arreglo: una lista de avisos aceptados con el motivo de cada lint, siguiendo el modelo de `git_strategy.policy.accepted_divergences`.

### F8. Los artefactos de secuenciación se pararon en la espina del MVP (Backlog, BAJA, pregunta)

`.context/dev-roadmap.md` dice "Edges last updated: 2026-10-04", y `master-implementation-plan.md` se tocó por última vez el 2026-10-05. Los dos describen los master sprints del MVP. Las ocho épicas abiertas de producto y mantenimiento (FRESCO-865 a FRESCO-884 y otras) no tienen orden de dependencias en ningún sitio. Pregunta: ¿se retiran estos ficheros ahora que el trabajo va por épica y por lote? Si sí, hay que decirlo en sus cabeceras. Si no, hay que refrescarlos.

### F9. Criterios de cierre en las tareas (Backlog, INFORMATIVO, solo hacia delante)

Cards de noviembre sin contar `Aplazada` ni `Rechazos`: las historias, 18 de 19, llevan sección de criterios o de verificación; las tareas, 98 de 162 (60 %); los defectos, 3 de 6. La búsqueda de texto de Jira es difusa, así que son cifras aproximadas. La convención `## Criterio de cierre` se decidió el 2026-11-23 (FRESCO-1253), así que estas cards la preceden; hay que volver a medir en la próxima pasada. Nota: `scripts/sync-jira-issues.ts:1415` extrae solo `Criterio de cierre`, mientras que muchas historias antiguas usan un encabezado `Verificación`.

### F10. El job e2e se acerca al aviso temprano de la ADR-0018 (Verificación, INFORMATIVO)

Los 12 últimos jobs `test:e2e` en verde en `staging` promediaron 365 s (máximo 393 s). 2 de los 12 estuvieron en 390 s o más, pero no seguidos, así que el disparador de la ADR-0018 ("~6m30s sostenido, dos ejecuciones consecutivas") no ha saltado. `audit-process.md` sección 4 sigue diciendo "~5.5 min". Nada mide el disparador automáticamente. Hay que vigilarlo; no actuar todavía.

### F11. Dos prefijos de rama fuera de la lista declarada (Trazabilidad, INFORMATIVO, desviación de patrón)

140 de las últimas 150 ramas de PR fusionadas siguen `{prefijo}/FRESCO-N-slug`. `ci/FRESCO-1202-…` y `perf/FRESCO-1145-…` usan prefijos que `git_strategy.branch_prefixes.precedence` no lista. Añadirlos o no cuesta lo mismo.

## 3. Hallazgos de la auditoría 9, comprobados de nuevo

| Auditoría 9 | Estado | Comprobado hoy con |
|---|---|---|
| F1 convención de criterios | Cerrado | `scripts/sync-jira-issues.ts:1415` extrae `## Criterio de cierre`; 18 de 19 historias llevan criterios |
| F2 cards sin épica | Cerrado | JQL de cards abiertas de `audit-process.md`: **0** |
| F3 número de ADRs en el glosario | Cerrado | el glosario ya no tiene la frase con la cifra |
| F4 índice de auditorías | Cerrado | filas de las auditorías 7b, 8 y 9 en `README.md` |
| F5 FRESCO-986 | Cerrado | no figura entre las épicas abiertas |
| F6 historia | Aceptado | `audit-process.md`, "Accepted history" |
| F7 `revalidate` | Cerrado | 0 en `app/page.tsx` |
| F8 sello de política | Cerrado | `policy_verified: 2026-11-23` |
| F9 escenarios | Clasificados | de la re-medición del 2026-11-23, no repetida; quedan 15 `@pendiente` en FRESCO-1262 a FRESCO-1267 |

## 4. Lo que respalda la evidencia

Medido o citado, no elogio general.

- **Todo cambio de código es trazable.** En `main` desde el 2026-10-23: 325 de 325 commits first-parent son convencionales; 168 de 168 commits `feat`, `fix`, `refactor` y `perf` llevan clave `FRESCO-` y `(#PR)`; 318 de 321 commits no automáticos llevan el trailer `Session:` (los tres sin él son los PR automáticos de refresco de catálogo #832, #922 y #950). Sin atribución a IA desde el 2026-10-15. Tamaño de commit en los últimos 200: mediana 2 ficheros, p90 10, máximo 45.
- **La puerta de promoción funciona.** 50 de 50 despliegues de producción desde el 2026-10-23 salieron de un SHA cuyo último `PR Check` de `staging` fue correcto. En septiembre, antes de `git:promote`, 17 de 179 SHAs llegaron a `main` con una ejecución de `staging` fallida.
- **La puerta de merge está viva, no solo documentada.** Los cinco checks requeridos se aplican en `main`, `staging` y `dev` (`gh api`, hoy). El pre-push ejecuta una guarda de versión de Bun y las puertas del framework; `test:coverage` corre en CI con un suelo de trinquete; el smoke posterior al despliegue salió en verde en los despliegues de producción de hoy.
- **Los defectos se registran bien.** De las 15 cards `Error` desde el 2026-10-15: severidad 15 de 15, evidencia 15 de 15, tipo de error 14 de 15, causa raíz 12 de 15.
- **Las capas se mantienen.** `cycles:check`: 483 ficheros, ningún ciclo. Cero imports de `lib/` hacia `components/` o `app/`, y cero de `components/` hacia `app/`. Los tres valores hex reales en componentes son la imagen Open Graph (Satori no lee variables CSS), el `themeColor` del navegador y un `color-mix` documentado.
- **La frontera de la base de datos aguanta donde el linter dudaba.** Toda función `SECURITY DEFINER` que un usuario autenticado puede llamar está acotada por `auth.uid()`, y ninguna es ejecutable por `anon`.
- **La infraestructura de tests nombra su propio riesgo.** `tests/session-login.ts`: "it must never be pointed at an account that is not a test account."
- **Los falsos positivos se descartan tras medir, por escrito.** `.context/bitacora.md`, 2026-11-20: el logo con carga diferida y las dos reglas `@font-face` sin `font-display` "eran falsos positivos (FRESCO-504; caras de respaldo de `next/font`), no se tocaron."
- **Las auditorías se corrigen a sí mismas.** La re-medición de la auditoría 9 declara su propio conflicto de intereses y corrige dos cifras erróneas del informe original.

## 5. Superficie en vivo

Solo lectura, mediante un subagente en `fresco-pre`.

- **Mitad autenticada: no alcanzada** (F5). Las dos identidades se detuvieron en el desafío de Turnstile. Las credenciales Pro nunca se teclearon.
- **`/login`, anónimo, a 390 y 1440 px.** `lang="es"`, un `h1`, sin saltos de encabezado, 0 de 2 imágenes sin `alt`, sin desbordamiento horizontal. El único objetivo de menos de 44 px es el enlace de salto, oculto visualmente. `responseStart` 119 ms, `domContentLoadedEventEnd` 1616 ms.
- **Consola.** 7 errores, todos dentro del marco de Cloudflare Turnstile (su propia CSP rechazando `data:`), 0 de la app.
- **Dos no-problemas.** El texto de Turnstile usa "usted" ("Verifique que es un ser humano") mientras la app usa "tú"; ese texto es del propio widget. Cuatro de las cinco rutas protegidas conservan `?next=` en la redirección anónima, y `/menu` no, lo que parece intencionado porque `/menu` es la página de entrada por defecto.

Capturas (temporales, no commiteadas): `login-captcha-blocked-390.png` y `login-captcha-blocked-1440.png` en el directorio temporal de esta sesión, bajo `audit10/live/`.

## 6. Puntos ciegos

- **La app autenticada no se ejercitó**, por segunda pasada seguida (F5). El control de acceso por planes, la comprobación de presupuesto de FRESCO-1269 sobre un menú real y los tiempos de `/menu` siguen sin medir. El rol de admin nunca se ha medido en vivo en ninguna pasada.
- **Configuración alojada.** Solo se leyeron el asesor de seguridad de Supabase y las definiciones de funciones. El asesor de rendimiento, los ajustes del proyecto de Vercel y los de Auth no se leyeron.
- **`.env.ci` está versionado y no se abrió**, por la regla 1 de `AGENTS.md`, igual que en la auditoría 9.
- **Los recuentos de backlog salen de la búsqueda de texto de Jira**, que es difusa. Un criterio escrito bajo otro encabezado o en un comentario no se cuenta.
- **La calidad de los tests se contó, no se muestreó.** Sin pasada de mutación.
- **Los 15 escenarios `@pendiente`** no se contrastaron de nuevo con sus cards.

## 7. Orden de trabajo sugerido (no es un plan, no se han creado cards)

1. **F1:** corregir el procedimiento de login y propagarlo a las Compact Rules, antes de la siguiente ejecución de UI en vivo.
2. **F6:** rellenar `root_cause` en FRESCO-1269 y decidir dónde espera hasta que se repita su reproducción.
3. **F2 y F3:** responder la pregunta de las preferencias Pro; después una ADR y tres frases.
4. **F5:** decidir cómo se comprueban las pantallas autenticadas (marca manual con ventana, stack local o punto ciego aceptado).
5. **F7 y F8:** una lista de avisos aceptados; retirar o refrescar los ficheros del roadmap.
6. **F4:** regenerar los mapas de API y de features.
7. **F9 a F11:** volver a medir en la próxima pasada.
