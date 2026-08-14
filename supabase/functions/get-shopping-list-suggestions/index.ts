// supabase/functions/get-shopping-list-suggestions/index.ts
//
// FRESCO-194 — "Sugerencias para ti" carousel on the shopping-list screen.
// Real data only: ingredients from the caller's OWN favorited recipes
// (`ingredientes_principales`, already a plain name array — no per-recipe
// quantity data exists, so a suggestion uses the same BASE_QUANTITIES
// default every other item's quantity is seeded from), that aren't already
// in the given list. No suggestion/recency data exists anywhere else in
// this app — this is the only real signal available (see FRESCO-194).
//
// Classification (pasillo + precio_estimado) reuses aisle-pricing.ts's
// exported `pasilloFor`/`precioUnitario` — the exact same functions
// generate-shopping-list uses per consolidated item, not a re-derived copy.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { normalizeNombre } from '../_shared/normalize.ts'
import { pasilloFor, precioUnitario } from '../generate-shopping-list/aisle-pricing.ts'
import { BASE_QUANTITIES } from '../generate-shopping-list/consolidator.ts'
import type {
  GetShoppingListSuggestionsRequest,
  GetShoppingListSuggestionsResponse,
  ShoppingListSuggestion,
} from './types.ts'

const FN_NAME = 'get-shopping-list-suggestions'
const MAX_SUGGESTIONS = 3

interface ShoppingListRow {
  items: { items: { nombre: string }[] }[]
}

interface FavoriteRecipeRow {
  recipes: { ingredientes_principales: string[] | null } | null
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    const authHeader = req.headers.get('Authorization')!
    const supabase = createRequestClient(authHeader)
    const user = await requireAuthenticatedUser(req, supabase)

    const body: GetShoppingListSuggestionsRequest = await req.json()
    if (!body.shopping_list_id) throw new HttpError('Falta shopping_list_id', 400)

    const { data: list, error: listError } = await supabase
      .from('shopping_lists')
      .select('items')
      .eq('id', body.shopping_list_id)
      .eq('user_id', user.id)
      .single<ShoppingListRow>()

    if (listError || !list) throw new HttpError('Lista no encontrada', 404)

    const enLista = new Set(
      list.items.flatMap(pasillo => pasillo.items.map(item => normalizeNombre(item.nombre))),
    )

    const { data: favoritos, error: favoritosError } = await supabase
      .from('favorites')
      .select('recipes ( ingredientes_principales )')
      .eq('user_id', user.id)
      .returns<FavoriteRecipeRow[]>()

    if (favoritosError) throw new HttpError('No se pudieron leer tus favoritos', 500)

    // Frequency across favorited recipes — how many different favorites call
    // for this ingredient — so the most recipe-relevant suggestions surface
    // first, not just an arbitrary order.
    const frecuencia = new Map<string, { nombre: string, count: number }>()
    for (const fav of favoritos ?? []) {
      const ingredientes = fav.recipes?.ingredientes_principales ?? []
      for (const nombre of ingredientes) {
        const normalizado = normalizeNombre(nombre)
        if (enLista.has(normalizado)) continue

        const existing = frecuencia.get(normalizado)
        if (existing) existing.count += 1
        else frecuencia.set(normalizado, { nombre, count: 1 })
      }
    }

    const top = [...frecuencia.values()]
      .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, MAX_SUGGESTIONS)

    const suggestions: ShoppingListSuggestion[] = top.map(({ nombre }) => {
      const normalizado = normalizeNombre(nombre)
      const base = BASE_QUANTITIES[normalizado] ?? { cantidad: 1, unidad: 'unidades' }
      const precio = precioUnitario(normalizado, base.unidad) * base.cantidad
      return {
        nombre,
        pasillo: pasilloFor(normalizado),
        cantidad: base.cantidad,
        unidad: base.unidad,
        precio_estimado: Math.round(precio * 100) / 100,
      }
    })

    const response: GetShoppingListSuggestionsResponse = { suggestions }
    return jsonResponse(response, { req })
  }
  catch (err) {
    return toErrorResponse(err, { req, fnName: FN_NAME })
  }
})
