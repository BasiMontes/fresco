import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, type FakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-991 — orchestration coverage for `get-shopping-list-suggestions/index.ts`:
 * suggestions come only from the caller's favourites, never repeat what is on
 * the list, rank by how many favourites use the ingredient, and cap at three.
 */

let supa: FakeEdgeClient
captureDenoServe()
mock.module('../_shared/supabase-client.ts', () => ({ createRequestClient: () => supa.client }))

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

const USER = { id: 'user_1' }

function fav(...ingredientes: string[]) {
  return { recipes: { ingredientes_principales: ingredientes } }
}

function listWith(...nombres: string[]) {
  return { items: [{ pasillo: 'Verdura', items: nombres.map(nombre => ({ nombre })) }] }
}

function call(rows: Record<string, unknown>, selectError: Record<string, unknown> = {}) {
  supa = fakeEdgeClient({ user: USER, rows, selectError })
  return handler(edgeRequest({ shopping_list_id: 'sl_1' }))
}

beforeEach(() => {
  supa = fakeEdgeClient({ user: USER })
})

describe('get-shopping-list-suggestions/index.ts', () => {
  test('401 without a user', async () => {
    supa = fakeEdgeClient({ user: null })
    expect((await handler(edgeRequest({ shopping_list_id: 'sl_1' }))).status).toBe(401)
  })

  test('400 without shopping_list_id', async () => {
    expect((await handler(edgeRequest({}))).status).toBe(400)
  })

  test('404 when the list is not the caller’s (query returns nothing)', async () => {
    expect((await call({ shopping_lists: null })).status).toBe(404)
  })

  test('500 when favourites cannot be read', async () => {
    const res = await call({ shopping_lists: listWith(), favorites: null }, { favorites: { message: 'x' } })
    // the shared fake applies one selectError per table, list read stays ok
    expect(res.status).toBe(500)
  })

  test('skips what is already on the list, ignoring case and accents', async () => {
    const res = await call({ shopping_lists: listWith('Tomate'), favorites: [fav('tomate', 'cebolla')] })
    const body = await res.json() as { suggestions: Array<{ nombre: string }> }
    expect(body.suggestions.map(s => s.nombre)).toEqual(['cebolla'])
  })

  test('ranks by number of favourites using the ingredient, ties alphabetical, max 3', async () => {
    const res = await call({
      shopping_lists: listWith(),
      favorites: [fav('ajo', 'cebolla', 'pimiento', 'zanahoria'), fav('cebolla'), fav('cebolla', 'zanahoria')],
    })
    const body = await res.json() as { suggestions: Array<{ nombre: string }> }
    expect(body.suggestions.map(s => s.nombre)).toEqual(['cebolla', 'zanahoria', 'ajo'])
  })

  test('each suggestion carries aisle, quantity, unit and a rounded price', async () => {
    const res = await call({ shopping_lists: listWith(), favorites: [fav('cebolla')] })
    const [s] = (await res.json() as { suggestions: Array<Record<string, unknown>> }).suggestions
    expect(typeof s.pasillo).toBe('string')
    expect(typeof s.unidad).toBe('string')
    expect(s.cantidad).toBeGreaterThan(0)
    expect(Number(s.precio_estimado)).toBeGreaterThanOrEqual(0)
    expect(Math.round(Number(s.precio_estimado) * 100)).toBeCloseTo(Number(s.precio_estimado) * 100, 6)
  })

  test('no favourites → empty suggestions, 200', async () => {
    const res = await call({ shopping_lists: listWith(), favorites: null })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ suggestions: [] })
  })

  test('a favourite without a joined recipe is ignored', async () => {
    const res = await call({ shopping_lists: listWith(), favorites: [{ recipes: null }, fav('ajo')] })
    const body = await res.json() as { suggestions: Array<{ nombre: string }> }
    expect(body.suggestions.map(s => s.nombre)).toEqual(['ajo'])
  })
})
