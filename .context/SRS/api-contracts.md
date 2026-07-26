# API & Prompt Contracts — Fresco

> SRS output of `/project-foundation` Phase 3 (Architecture — Software side). Traces to `functional-requirements.md`. Primary source: `fresco-core-tecnico.md` §3–4, `fresco-edge-function-generate.md`, `fresco-shopping-list.md`, `fresco-aprendizaje.md`.
>
> **Format note, deliberate deviation from the SRS template default:** the template (`srs-api-contracts.md`) asks for an OpenAPI 3.0 `api-contracts.yaml`. Fresco's actual system surface is not a conventional public REST API — it is three authenticated Supabase Edge Functions, two of which are themselves thin orchestration wrappers around **LLM prompt contracts** (a system+user prompt in, a strict JSON schema out). Documenting those as bare OpenAPI request/response shapes would lose the part that actually matters: the *rules* governing what the model is allowed to return, which are the real interface contract here, more than HTTP verbs and status codes are. This document therefore treats each prompt as a contract in its own right (input shape → output schema → the rules constraining that output), nested inside the Edge Function that calls it, and summarizes each system prompt's rules as a specification rather than reproducing the full prompt text verbatim — this is a contract document, not a prompt-engineering document. All three Edge Functions are documented as conventional HTTP contracts first.

## 0. Conventions common to all three Edge Functions

- **Transport**: `POST` to `https://<project>.functions.supabase.co/<function-name>`, `Content-Type: application/json`.
- **Auth**: `Authorization: Bearer <supabase-jwt>` required on every call; missing/invalid → `401 { "error": "No autorizado" }`. (Guest-mode's auth path is unresolved — see `functional-requirements.md` FR-6.1.)
- **Error shape**: every non-2xx response is `{ "error": string }` with an HTTP status carrying the semantic (`400` validation, `401` unauthorized, `403` forbidden, `404` not found, `409` conflict/already-exists, `422` unprocessable, `502` upstream/LLM failure, `500` internal).
- **CORS**: `OPTIONS` preflight returns `Access-Control-Allow-Origin: *` and the standard Supabase client headers (dev-time convenience; source docs do not scope this further for production).

## 1. `POST /generate-meal-plan`

Orchestrates FR-2.1–FR-2.10. Source: `fresco-edge-function-generate.md`.

### Request

```typescript
interface GenerateRequest {
  semana_iso:   string // 'YYYY-WXX'
  fecha_inicio: string // 'YYYY-MM-DD', the Monday of that week
}
```

### Response — `200`

```typescript
interface GenerateResponse {
  meal_plan_id: string // uuid
  semana_iso:   string
  menu: Record<DiaSemana, Record<TipoPlato, Recipe>>  // 7 days × 3 slots, full recipe objects (not bare ids)
  advertencias: string[]  // MUST be surfaced to the user when non-empty — FR-2.10 / FR-8.2
}
```

### Error responses

| Status | Condition |
|---|---|
| `400` | `semana_iso` or `fecha_inicio` missing |
| `401` | missing/invalid auth |
| `404` | `user_profiles` row not found |
| `409` | a plan for this `semana_iso` already exists for this user (no silent overwrite) |
| `422` | fewer than 21 recipes survive the allergen/diet SQL pre-filter — catalog too small for this profile |
| `502` | the model failed to produce a valid menu after `MAX_RETRIES = 2` attempts |
| `500` | unexpected internal error |

### 1a. Nested contract — the menu-selection prompt

**Input to the prompt** (built server-side, never sent verbatim by the client):
- User profile: household size, active diet flags, allergens, disliked ingredients, favorite cuisines, weekday/weekend time budgets, spice tolerance, richness preference, weekly euro budget, target ISO week, current season.
- **History section — tier-dependent, this is the Free/Pro fork (FR-2.5, FR-5.4):** Pro → the last-2-weeks recipe-id history; Free → an explicit "no history" marker, never omitted silently.
- The pre-filtered recipe catalog (already excludes allergen/hated-ingredient conflicts at the SQL layer — this is Layer 1 of FR-8.1; the prompt catalog is the *output* of `get_filtered_recipes()`, not the raw table), serialized compactly: id, name, type, category, cuisine, minutes, cost bucket, seasons, richness/lightness flags, tupper-suitability, and the learning fields (`veces_cocinada`, `veces_descartada`, `rating_promedio`, `ultima_vez_en_menu`).

**Rules the model must follow** (summarized as a spec — see `functional-requirements.md` FR-2.3–FR-2.8 for the authoritative, numbered version; full original prompt text lives in `fresco-core-tecnico.md` §3, not reproduced here):
1. Absolute, non-negotiable: never an allergen recipe, never a hated-ingredient recipe, never (Pro) a last-2-weeks repeat, never over budget, JSON-only response.
2. Quality (best-effort): category/protein variety, seasonal preference, richness balancing, prioritize proven (cooked/rated) recipes, avoid frequently-discarded recipes, respect weekday/weekend time budgets, breakfast repeat cap of 3.
3. **Pro-only addendum** (`fresco-aprendizaje.md`): when real history exists, populate `advertencias` with 2–3 warm, specific, first-person-plural sentences explaining what was adjusted and why (FR-5.5) — omitted entirely (not an empty placeholder sentence) when the user has no history yet.

**Output — the exact JSON schema the model must return:**

```jsonc
{
  "semana": "YYYY-WXX",
  "menu": {
    "lunes":     { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "martes":    { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "miercoles": { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "jueves":    { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "viernes":   { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "sabado":    { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" },
    "domingo":   { "desayuno": "recipe_id", "comida": "recipe_id", "cena": "recipe_id" }
  },
  "advertencias": []  // string[] — populated per the rules above; MUST be read by the caller, never discarded
}
```

`advertencias` is populated when: a slot had no suitable recipe (and what was substituted), the budget forced a variety trade-off, a mandatory filter could not be honored at all (P0, safety-critical — FR-8.2), or (Pro-only, real history) a learning explanation. Server-side model config: `temperature: 0.7` (variety without losing filter coherence), `responseMimeType: 'application/json'`, `maxOutputTokens: 1024`.

**Server-side output validation** (the contract the backend enforces on the model's response before it is trusted — FR-2.9): valid JSON; `semana` matches the request; all 7×3 slots present; every `recipe_id` exists in the filtered catalog; no lunch/dinner repeat; breakfast repeats ≤ 3. Failing any check triggers a retry (max 2); exhausting retries returns `502` to the caller — an invalid menu is never persisted.

## 2. `POST /generate-shopping-list`

Orchestrates FR-4.1–FR-4.4. Source: `fresco-shopping-list.md`.

### Request

```typescript
interface Request {
  meal_plan_id: string // uuid — must already exist and belong to the caller
}
```

### Response — `200`

```typescript
interface ShoppingListResponse {
  shopping_list_id: string
  pasillos: Array<{
    nombre: string          // exact aisle name, from the fixed 13-aisle vocabulary
    orden:  number
    items:  Array<{ nombre: string; cantidad: number; unidad: string; comprado: boolean }>
  }>
  resumen: {
    total_items:        number
    coste_estimado_min: number
    coste_estimado_max: number
    moneda:             'EUR'
  }
}
```

### Error responses

| Status | Condition |
|---|---|
| `400` | `meal_plan_id` missing |
| `401` | missing/invalid auth |
| `404` | plan not found, or does not belong to caller |
| `409` | a shopping list already exists for this plan |
| `422` | ingredient consolidation produced zero items |
| `502` | model failed to produce a usable pasillo grouping after `MAX_RETRIES = 2` attempts |
| `500` | unexpected internal error |

### 2a. Nested contract — ingredient consolidation (pre-model, deterministic, no LLM involved)

**Input**: all 21 slots' recipes for the plan, each recipe's `ingredientes_principales`, the household's `num_personas`, and each recipe's base `raciones`.

**Processing** (pure application code, FR-4.1): normalize each ingredient name (lowercase, trim, accent-strip); look up a base quantity/unit per normalized name; scale by `num_personas / raciones`; merge duplicates by summing compatible units (`g`↔`kg`, `ml`↔`l` auto-convert; incompatible unit types are kept separate, logged as a rare edge case rather than silently merged).

**Output**: `IngredienteConsolidado[]` — `{ nombre, cantidad, unidad }`, deduplicated, no recipe attribution retained. This consolidated list — never the raw per-recipe ingredient lists — is what gets sent to the model next.

### 2b. Nested contract — the shopping-list prompt

**Input to the prompt**: the consolidated ingredient list from §2a, plus `semana_iso`, `num_personas`, recipe count — for context only, not for recomputation. The model is explicitly told the list is already summed and deduplicated.

**Rules the model must follow** (summarized — full text `fresco-shopping-list.md`):
1. Assign each ingredient to exactly one of the 13 fixed aisles (exact names, see `functional-requirements.md` FR-4.2), preferring the most specific aisle when an ingredient could plausibly fit two (e.g. jarred tomato sauce → Conservas y salsas, not Frutas y verduras).
2. Normalize units to the fixed vocabulary (FR-4.3) — no ambiguous abbreviations.
3. Sort items alphabetically within each aisle.
4. **Never invent an ingredient not in the input list; never drop one.**
5. JSON-only response, no markdown.

**Output — the exact JSON schema the model must return:**

```jsonc
{
  "pasillos": [
    {
      "nombre": "Frutas y verduras",
      "orden": 1,
      "items": [
        { "nombre": "cebolla", "cantidad": 4, "unidad": "unidades", "comprado": false }
      ]
    }
  ],
  "resumen": {
    "total_items": 0,
    "coste_estimado_min": 0,
    "coste_estimado_max": 0,
    "moneda": "EUR"
  }
}
```

Only aisles with ≥1 item are included. `resumen.coste_estimado_*` is a best-effort estimate against 2024 Spanish supermarket pricing; the model is instructed to return `0`/`0` rather than guess when it lacks confidence. Server-side model config: `temperature: 0.2` (classification task, consistency over variety), `responseMimeType: 'application/json'`, `maxOutputTokens: 2048`.

**Server-side output validation** (FR-4.4): `pasillos` array present; total item count across all aisles ≥ 90% of the consolidated input count (below that threshold, retry — a legitimate model-side merge of near-duplicate ingredients, e.g. "ajo" + "ajo fresco" → "ajo", accounts for the 10% tolerance).

## 3. Item-level shopping-list update (not an Edge Function)

**`comprado` toggle** (FR-4.4) bypasses the Edge Function layer entirely — a direct authenticated Supabase client call:

```typescript
supabase.from('shopping_lists').update({
  items: supabase.rpc('jsonb_set_comprado', {
    p_list_id: string, p_pasillo_idx: number, p_item_idx: number, p_comprado: boolean,
  }),
}).eq('id', listId)
```

Backed by a `security definer` SQL function performing a targeted `jsonb_set` on the single `comprado` boolean — documented here because it is part of the shopping-list interface contract, even though it is not itself an Edge Function.

## 4. `PATCH /update-recipe-status` (via Edge Function `update-recipe-status`)

Orchestrates FR-5.1–FR-5.3. Source: `fresco-aprendizaje.md`.

### Request

```typescript
interface UpdateRequest {
  meal_plan_recipe_id: string   // uuid, required
  estado:              'pendiente' | 'cocinada' | 'descartada' | 'sustituida'  // required
  rating?:             number   // 1-5, only meaningful when estado = 'cocinada'
  nueva_recipe_id?:    string   // uuid, required when estado = 'sustituida'
}
```

### Response — `200`

```typescript
{ ok: true, estado: string }
```

The recipe's aggregate learning fields (`veces_cocinada`/`veces_descartada`/`rating_promedio`) are updated **by a database trigger** (`recipe_learning_trigger`), not by this function directly — the Edge Function's only job is the authorized, validated write to `meal_plan_recipes`; the learning side effect is the database's responsibility, not the API's.

### Error responses

| Status | Condition |
|---|---|
| `400` | missing `meal_plan_recipe_id`/`estado`; `rating` outside 1–5; `estado = 'sustituida'` without `nueva_recipe_id` |
| `401` | missing/invalid auth |
| `403` | the slot's parent `meal_plan` does not belong to the caller |
| `404` | slot not found |
| `409` | the slot is already `cocinada` or `descartada` — state is terminal, cannot be re-patched (FR-5.1) |
| `500` | unexpected internal error |

## 5. Nested contract — batch recipe-generation prompt (offline, not a live API)

Not an Edge Function and not called from the frontend — this is a **founder-operated, manual** prompt (`fresco-core-tecnico.md` §4) used to seed and periodically extend the recipe catalog. Documented here because it is still a formal input→output contract that defines the shape of every row later served by every other contract in this document.

**Input**: `N` (count to generate) plus a fixed set of curation criteria — Spanish/Latin home cooking only, category variety mandatory, tupper-friendliness and weeknight-speed quotas, minimum vegetarian/vegan/gluten-free counts, no haute cuisine or hard-to-source ingredients.

**Output** — an array of objects matching the `recipes` write shape (`nombre`, `slug`, `meta`, `clasificacion`, `dieta`, `alergenos`, `ingredientes_principales`, `ingredientes_que_puede_desagradar`, `temporada`, `descripcion_corta` ≤120 chars, `pasos_resumen` ≤5 steps) — the same field vocabulary consumed everywhere else in this document, minus the `aprendizaje` block (new recipes start at zero cooked/discarded/rated, so the model is never asked to fabricate that history).

**Human-in-the-loop gate, not a live validation function**: every batch is manually reviewed against an explicit checklist (allergen accuracy against the 14 EU-regulated list, vegetarian/vegan/gluten-free flag correctness, time-field internal consistency, Spain-market cost realism, category variety, step-count limits) **before** insertion into `recipes` via the `service_role` key. This is the same manual-safety posture as FR-8.3 — a human backstop that exists independently of, and prior to, any code-level guarantee.
