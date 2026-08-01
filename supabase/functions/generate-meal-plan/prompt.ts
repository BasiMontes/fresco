// Gemini prompt-building for weekly menu selection — implemented by
// STORY-FRESCO-9 (Food Safety guardrail, EPIC-FRESCO-8). index.ts's control
// flow (auth, SQL pre-filter, Free/Pro history branch, retry loop,
// persistence, rollback) was already real; this file completes the actual
// prompt text, closing FR-8.1's Layer 2 (semantic reinforcement) alongside
// the Layer 1 SQL pre-filter in `get_filtered_recipes()`.
//
// Scope note (do not re-implement in FRESCO-7): FRESCO-9's own ticket scope
// is food-safety only (allergen/disliked-ingredient exclusion, REGLAS
// ABSOLUTAS 1-2). Rules 3-5 below (history repeat, weekly budget, soft
// quality rules) are functionally EPIC-FRESCO-5/FRESCO-7 territory, but were
// completed here too, at explicit user request, because this file's two
// exported functions are a single shared seam — leaving rules 3-5 as a
// second stub would have kept the Edge Function fully broken for everyone
// and given FRESCO-7 an awkward half-finished file to pick up mid-function.
// FRESCO-7 should consume `buildSystemPrompt()`/`buildUserPrompt()` as-is,
// not re-author them.
//
// Full rule text source: functional-requirements.md FR-2.3-FR-2.8, FR-8.1,
// FR-8.2; api-contracts.md §1/§1a for the request/response + prompt contract
// conventions this implementation matches.

import type { Recipe, UserProfile } from './types.ts'
import { NO_SAFE_RECIPE_SENTINEL } from './types.ts'

const DIETA_LABELS: Record<string, string> = {
  dieta_vegetariano: 'vegetariano',
  dieta_vegano: 'vegano',
  dieta_sin_gluten: 'sin gluten',
  dieta_sin_lactosa: 'sin lactosa',
  dieta_sin_huevo: 'sin huevo',
  dieta_keto: 'keto',
  dieta_halal: 'halal',
}

/** Northern-hemisphere season for the Spanish market (fresco-core-tecnico.md §3). */
function getCurrentSeason(): string {
  const month = new Date().getMonth() // 0-11
  if (month === 11 || month === 0 || month === 1) return 'invierno'
  if (month >= 2 && month <= 4) return 'primavera'
  if (month >= 5 && month <= 7) return 'verano'
  return 'otoño'
}

function serializeDietFlags(profile: UserProfile): string {
  const active = Object.entries(DIETA_LABELS)
    .filter(([key]) => profile[key as keyof UserProfile] === true)
    .map(([, label]) => label)

  return active.length > 0 ? active.join(', ') : 'sin restricciones de dieta'
}

/** Compact, token-efficient one-line-per-recipe serialization (api-contracts.md §1a). */
function serializeRecipe(recipe: Recipe): string {
  const meta = recipe.meta
  const clasificacion = recipe.clasificacion
  const temporada = recipe.temporada && recipe.temporada.length > 0
    ? recipe.temporada.join(',')
    : 'todo_el_año'
  const flags = [
    clasificacion?.es_contundente ? 'contundente' : null,
    clasificacion?.es_ligero ? 'ligero' : null,
    clasificacion?.apto_tupper ? 'tupper' : null,
  ]
    .filter((flag): flag is string => flag !== null)
    .join(',') || '-'

  return [
    recipe.id,
    recipe.nombre,
    clasificacion?.tipo_plato ?? '-',
    clasificacion?.categoria ?? '-',
    clasificacion?.cocina ?? '-',
    meta ? `${meta.tiempo_total_min}min` : '-',
    meta?.coste_estimado ?? '-',
    temporada,
    flags,
    `cocinada:${recipe.veces_cocinada}`,
    `descartada:${recipe.veces_descartada}`,
    `rating:${recipe.rating_promedio ?? '-'}`,
    `ultima_vez:${recipe.ultima_vez_en_menu ?? 'nunca'}`,
  ].join('|')
}

/**
 * REGLAS ABSOLUTAS 1-2 = FR-2.3/FR-2.4 (this ticket's core scope, Food
 * Safety). Rules 3-5 = FR-2.5 (Pro-only history, FRESCO-7/EPIC-5 scope),
 * FR-2.6 (weekly budget, FRESCO-7 scope), FR-2.7 (JSON-only output). The
 * REGLAS DE CALIDAD block = FR-2.8, explicitly best-effort per that FR, so
 * it is worded as strong preferences here, not absolute rules.
 */
export function buildSystemPrompt(): string {
  return `Eres el motor de generación de menús semanales de Fresco, una app de meal-planning para el mercado español. Tu única tarea es seleccionar recetas del catálogo proporcionado para rellenar las 21 franjas de la semana solicitada (7 días x desayuno/comida/cena), respetando estrictamente las siguientes reglas.

## REGLAS ABSOLUTAS (no negociables — incumplir cualquiera de estas invalida el menú)
1. Nunca incluyas una receta que contenga alguno de los alérgenos declarados por el usuario. (FR-2.3)
2. Nunca incluyas una receta con un ingrediente que esté en la lista de "ingredientes que no le gustan" del usuario. (FR-2.4)
3. En el plan Pro: nunca repitas una receta que haya aparecido en el historial de las últimas 2 semanas del usuario. En el plan Free no recibirás historial — genera la semana desde cero, esta regla no aplica. (FR-2.5)
4. Nunca superes el presupuesto semanal declarado por el usuario, sumando el coste estimado de las 21 recetas seleccionadas. (FR-2.6)
5. Responde ÚNICAMENTE con el JSON especificado más abajo. Sin texto explicativo, sin markdown, sin bloques de código. (FR-2.7)

## REGLAS DE CALIDAD (preferencias fuertes, mejor esfuerzo — no bloqueantes) (FR-2.8)
- Evita repetir la misma categoría (p. ej. pasta) dos días seguidos; varía proteínas.
- Prioriza recetas de temporada sobre las de "todo el año" cuando ambas estén disponibles para una franja.
- Equilibra la contundencia: intenta que un plato contundente un día vaya seguido de algo más ligero al día siguiente.
- Prioriza recetas con mayor "veces_cocinada" y "rating_promedio" — son la señal de que ya funcionan en el hogar.
- Evita recetas con "veces_descartada" superior a 2, salvo que no haya alternativa en el catálogo filtrado.
- Los días entre semana deben respetar el tiempo máximo entre semana del usuario; los fines de semana pueden usar el tiempo máximo de fin de semana, más generoso.
- El desayuno puede repetirse hasta 3 veces por semana; comida y cena, en cambio, nunca deberían repetirse en la misma semana.

## ADVERTENCIAS ("advertencias") (FR-2.10 / FR-8.2)
Rellena el array "advertencias" cuando:
- Una franja se quede sin ninguna receta adecuada disponible (indica qué sustituiste y por qué).
- El presupuesto sea demasiado ajustado para mantener variedad.
- CASO CRÍTICO DE SEGURIDAD ALIMENTARIA: ninguna receta del catálogo cumple una regla absoluta (alérgeno, ingrediente no deseado, historial, presupuesto) para una franja concreta. En este caso NUNCA inventes ni fuerces una receta insegura para rellenar el hueco. En su lugar:
  1. Pon exactamente el valor "${NO_SAFE_RECIPE_SENTINEL}" como "recipe_id" de esa franja — nunca un id real del catálogo que no cumpla las reglas, y nunca dejes el campo vacío o ambiguo. Esta es la ÚNICA situación donde "recipe_id" puede no ser un id real.
  2. Añade una advertencia nombrando exactamente el día y la comida afectados (ej. "No hay ninguna receta segura para el desayuno del lunes con tus restricciones declaradas."). Dejar la advertencia explícita es obligatorio — un menú nunca debe entregarse como seguro en silencio.

## EXPLICACIÓN DE APRENDIZAJE ("explicacion_aprendizaje") (FR-5.5)
Este campo es independiente de "advertencias" — nunca mezcles su contenido con las advertencias de seguridad/calidad de arriba.
- Solo Pro, con historial real: 2-3 frases cálidas, específicas y en primera persona del plural explicando qué ajustaste en el menú y por qué (ej. "Vimos que descartaste las recetas con berenjena, así que las hemos evitado").
- Si el usuario es Free, o es Pro pero todavía no tiene historial (primeras 2 semanas), este campo debe ser exactamente "null" — nunca una frase vacía, genérica o inventada para rellenar el hueco.

## FORMATO DE SALIDA
Responde EXCLUSIVAMENTE con este JSON, sin ningún texto adicional:
{
  "semana": "YYYY-WXX",
  "menu": {
    "lunes": { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "martes": { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "miercoles": { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "jueves": { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "viernes": { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "sabado": { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "domingo": { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" }
  },
  "advertencias": [],
  "explicacion_aprendizaje": null
}
Cada "recipe_id" debe ser exactamente uno de los ids listados en el catálogo del mensaje de usuario, salvo el caso "${NO_SAFE_RECIPE_SENTINEL}" descrito arriba.`
}

export interface BuildUserPromptParams {
  profile: UserProfile
  recipes: Recipe[]
  recentRecipeIds: string[]
  semanaIso: string
  isPro: boolean
}

// Found live (2026-08-01): after the catalog grew past ~150 recipes, a
// lenient profile's SQL-filtered set can run past 300 — every one of those
// was being serialized into the prompt in full, ballooning input tokens and
// visibly slowing generation for exactly the users who need it least (few
// restrictions = huge candidate pool = huge prompt). The model only ever
// needs enough real variety to fill 21 slots well, not every match; capping
// per tipo_plato keeps the three meal types evenly represented regardless of
// how large the underlying catalog grows.
const MAX_RECIPES_PER_TIPO_IN_PROMPT = 40

/**
 * Caps how many recipes of each `tipo_plato` are shown to the model,
 * shuffled per call so repeated generations for the same profile don't
 * always see the identical capped subset. A no-op below the cap.
 */
function sampleForPrompt(recipes: Recipe[]): Recipe[] {
  const byTipo = new Map<string, Recipe[]>()
  for (const recipe of recipes) {
    const tipo = recipe.clasificacion?.tipo_plato ?? 'comida'
    const group = byTipo.get(tipo) ?? []
    group.push(recipe)
    byTipo.set(tipo, group)
  }

  const sampled: Recipe[] = []
  for (const group of byTipo.values()) {
    if (group.length <= MAX_RECIPES_PER_TIPO_IN_PROMPT) {
      sampled.push(...group)
      continue
    }
    const shuffled = [...group].sort(() => Math.random() - 0.5)
    sampled.push(...shuffled.slice(0, MAX_RECIPES_PER_TIPO_IN_PROMPT))
  }
  return sampled
}

/**
 * Serializes profile + filtered catalog + history section into the user
 * prompt. `isPro` gates whether `recentRecipeIds` is included at all (FR-2.5,
 * ADR-0001) — Free-tier history must never reach the prompt text, so the
 * branch below never reads `recentRecipeIds` on the Free path at all, not
 * just omits it after reading it.
 *
 * CLAUDE.md §10: 3+ params → object param, hence the single-object signature.
 */
export function buildUserPrompt({
  profile,
  recipes,
  recentRecipeIds,
  semanaIso,
  isPro,
}: BuildUserPromptParams): string {
  const temporada = getCurrentSeason()
  // Caps the PROMPT TEXT only — `index.ts` still validates the model's
  // response against the full filtered `validRecipeIds` set, so this never
  // narrows what counts as a "real" recipe, only what gets shown per call.
  const catalogo = sampleForPrompt(recipes).map(serializeRecipe).join('\n')

  const historial = !isPro
    ? 'Plan Free: no se aplica historial de repetición (REGLA ABSOLUTA 3 no aplica a este plan).'
    : recentRecipeIds.length > 0
      ? `Recetas usadas en las últimas 2 semanas, NO repetir (REGLA ABSOLUTA 3): ${recentRecipeIds.join(', ')}`
      : 'Usuario Pro sin historial todavía (primeras 2 semanas) — genera la semana desde cero.'

  const presupuesto = profile.presupuesto_semana_euros !== null
    ? `${profile.presupuesto_semana_euros}€ (REGLA ABSOLUTA 4)`
    : 'sin límite declarado'

  return `## SEMANA A GENERAR
${semanaIso} (temporada actual: ${temporada})

## PERFIL DEL USUARIO
- Personas en el hogar: ${profile.num_personas} (${profile.adultos} adultos, ${profile.ninos} niños)
- Alérgenos declarados (REGLA ABSOLUTA 1): ${profile.alergenos.length > 0 ? profile.alergenos.join(', ') : 'ninguno'}
- Ingredientes que no le gustan (REGLA ABSOLUTA 2): ${profile.ingredientes_odiados.length > 0 ? profile.ingredientes_odiados.join(', ') : 'ninguno'}
- Ingredientes favoritos: ${profile.ingredientes_favoritos.length > 0 ? profile.ingredientes_favoritos.join(', ') : 'ninguno indicado'}
- Dietas activas: ${serializeDietFlags(profile)}
- Cocinas favoritas: ${profile.cocinas_favoritas.length > 0 ? profile.cocinas_favoritas.join(', ') : 'sin preferencia'}
- Nivel de picante: ${profile.nivel_picante}
- Contundencia preferida: ${profile.contundencia_preferida}
- Tiempo máximo entre semana: ${profile.tiempo_max_semana_min} min
- Tiempo máximo fin de semana: ${profile.tiempo_max_finde_min} min
- Presupuesto semanal: ${presupuesto}

## HISTORIAL (últimas 2 semanas)
${historial}

## CATÁLOGO DE RECETAS DISPONIBLES
Ya filtrado por alérgenos/dieta/ingredientes no deseados a nivel SQL (REGLAS ABSOLUTAS 1-2, Layer 1 de FR-8.1) — este catálogo es la única fuente válida de "recipe_id".
Formato por línea: id|nombre|tipo_plato|categoria|cocina|tiempo_total|coste|temporada|flags|veces_cocinada|veces_descartada|rating|ultima_vez_en_menu

${catalogo}

Selecciona un "recipe_id" del catálogo anterior para cada una de las 21 franjas y responde con el JSON especificado en las instrucciones del sistema.`
}
