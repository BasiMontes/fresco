import type { APIRequestContext } from '@playwright/test';
import { currentWeekMonday, getAccessToken, isoWeekOf, mondayOfWeekContaining, restHeaders, serviceRoleHeaders } from './test-helpers';

/**
 * Per-test data factory (FRESCO-308) — replaces reuse of the shared, fixed
 * `DEV_USER_EMAIL`/`PRO_USER_EMAIL` accounts for scenarios that WRITE to
 * `meal_plans`/`meal_plan_recipes`/`user_profiles`. Root cause this fixes:
 * those accounts are shared, mutable, real backend state (there is exactly
 * ONE Supabase project, `jdqemhewjrjuopssdurn`, for dev/local/CI alike) — two
 * scenarios racing to reset+reseed the same account's current-week plan is
 * what produced the live RLS 403 / 500 "Error guardando el plan en la BD" /
 * shopping-list timeout failures this ticket exists to fix at the root,
 * rather than only serializing around (FRESCO-289's `concurrency` group).
 *
 * Each scenario that needs one now creates its OWN throwaway Supabase Auth
 * user via the GoTrue admin REST API (`SUPABASE_SERVICE_ROLE_KEY`, same key
 * `serviceRoleHeaders()` already uses elsewhere in this suite), seeds
 * whatever `user_profiles`/`meal_plans` rows that scenario needs under that
 * user's own id, and deletes the auth user afterwards. Deleting the auth
 * user is enough cleanup on its own: every table a scenario could have
 * written to (`user_profiles`, `meal_plans`, `meal_plan_recipes`,
 * `shopping_lists`, `favorites`, `recetas_propias`, `push_subscriptions`)
 * has an `ON DELETE CASCADE` foreign key back to `user_profiles.id` /
 * `auth.users.id` (confirmed live via the Supabase MCP against this
 * project's actual `pg_constraint` — not assumed), so one admin delete call
 * removes everything that scenario created, pass or fail.
 *
 * This is a scoped mitigation, not the KATA migration ADR-0014 explicitly
 * declined ("do not migrate to KATA now"): no ATC units, no `@atc` tags, no
 * suite-wide architecture change — just data-factory functions the existing
 * `playwright-bdd` step files call instead of touching the shared accounts.
 * ADR-0014 itself names "the @aprendizaje shared-state problem needs solving
 * anyway" as a signal that would justify revisiting that decision; this
 * ticket is that signal materializing, addressed at the scope it actually
 * requires today.
 *
 * Real gmail.com address (matching the existing `hola.frescoapp+{dev,pre,
 * pro}-user@gmail.com` test-account convention, not a fabricated `.test`/
 * `.local` domain) — `signup.steps.ts`'s header already documents that this
 * project's email validator rejects fake TLDs. No email is ever actually
 * sent: `email_confirm: true` on admin-created users skips Supabase Auth's
 * confirmation-email flow entirely.
 */

export interface TestUser {
  id: string
  email: string
  password: string
  accessToken: string
}

export interface CreateTestUserOptions {
  /** @default 'free' */
  plan?: 'free' | 'pro' | 'family'
}

export type TestUserFactory = (options?: CreateTestUserOptions) => Promise<TestUser>;

function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

function uniqueTestEmail(): string {
  return `hola.frescoapp+e2e-${crypto.randomUUID()}@gmail.com`;
}

function generateTestPassword(): string {
  return `E2e-Test-${crypto.randomUUID()}-Aa1!`;
}

async function createAuthUser(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${supabaseUrl()}/auth/v1/admin/users`, {
    headers: serviceRoleHeaders(),
    data: { email, password, email_confirm: true },
  });
  if (!res.ok()) { throw new Error(`[test-user-factory] Failed to create test user: ${res.status()} ${await res.text()}`); }
  const body = await res.json() as { id: string };
  return body.id;
}

async function deleteAuthUser(request: APIRequestContext, userId: string): Promise<void> {
  const res = await request.delete(`${supabaseUrl()}/auth/v1/admin/users/${userId}`, {
    headers: serviceRoleHeaders(),
  });
  // 404 = already gone: a normal outcome now that a scenario can delete its
  // own factory user mid-test (@perfil "Borrar cuenta definitivamente",
  // FRESCO-355). Only a real failure (403/500/network) is worth surfacing.
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`[test-user-factory] Failed to delete test user ${userId}: ${res.status()} ${await res.text()}`);
  }
}

async function createUserProfileRow(request: APIRequestContext, userId: string, accessToken: string, plan: NonNullable<CreateTestUserOptions['plan']>): Promise<void> {
  // The new user's OWN token, not service-role — confirmed live against this
  // project (`service_role` has no INSERT grant on `public.user_profiles`,
  // only UPDATE/SELECT; every other service-role write in this suite is an
  // UPDATE, so this factory is the first caller to ever need INSERT here).
  // This is also the semantically correct path anyway: it's exactly how the
  // real app creates this row (`upsertUserProfile`, as the signed-in user),
  // and `profiles_insert_own`'s RLS policy only checks `auth.uid() = id` —
  // no column restriction — so `plan` can be set on this very first INSERT
  // even though `protect_subscription_columns` (ADR-0007) would block a
  // later non-service-role UPDATE to it.
  const res = await request.post(`${supabaseUrl()}/rest/v1/user_profiles`, {
    headers: { ...restHeaders(accessToken), Prefer: 'return=minimal' },
    data: { id: userId, plan },
  });
  if (!res.ok()) { throw new Error(`[test-user-factory] Failed to seed user_profiles for ${userId}: ${res.status()} ${await res.text()}`); }
}

/**
 * Builds a fresh `{ factory, cleanupAll }` pair, one per test — `factory()`
 * creates and tracks a new isolated test user, `cleanupAll()` deletes every
 * user that scenario created. Wired into `tests/fixtures.ts`'s `testUserFactory`
 * fixture, whose teardown (guaranteed by Playwright to run after the test
 * body regardless of pass/fail) calls `cleanupAll()` — no step file needs to
 * remember to clean up after itself.
 */
export function createTestUserFactory(request: APIRequestContext): { factory: TestUserFactory, cleanupAll: () => Promise<void> } {
  const createdIds: string[] = [];

  const factory: TestUserFactory = async (options = {}) => {
    const email = uniqueTestEmail();
    const password = generateTestPassword();
    const id = await createAuthUser(request, email, password);
    // Tracked for cleanup immediately — if seeding below throws, teardown
    // still removes this (now orphaned) auth user and anything cascaded
    // from it, instead of leaking it into the shared backend.
    createdIds.push(id);
    const accessToken = await getAccessToken(request, email, password);
    await createUserProfileRow(request, id, accessToken, options.plan ?? 'free');
    return { id, email, password, accessToken };
  };

  const cleanupAll = async (): Promise<void> => {
    await Promise.all(createdIds.map(async (id) => {
      try {
        await deleteAuthUser(request, id);
      }
      catch (error) {
        // Best-effort: a failed cleanup must never fail the test it's
        // tearing down after — surfaced to the CI log for manual follow-up.
        console.error(`[test-user-factory] cleanup failed for ${id}:`, error);
      }
    }));
  };

  return { factory, cleanupAll };
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

/**
 * Seeds a full current-week plan (21 slots, one real recipe per `tipo_plato`,
 * distinct names so a caller can assert "swapped" vs "unchanged" the same
 * way `calendario.steps.ts` originally did against the shared `PRO_USER_EMAIL`
 * account's plan) for `testUser`'s own current week.
 */
export async function seedFullWeekMenu(request: APIRequestContext, testUser: TestUser): Promise<{ comidaNombre: string, cenaNombre: string }> {
  const headers = restHeaders(testUser.accessToken);
  const { semanaIso, fechaInicio } = currentWeekMonday();

  const recipesByTipo: Record<string, { id: string, nombre: string }> = {};
  for (const tipo of TIPOS) {
    const res = await request.get(
      `${supabaseUrl()}/rest/v1/recipes?select=id,nombre&clasificacion->>tipo_plato=eq.${tipo}&limit=1`,
      { headers },
    );
    const [recipe] = await res.json() as { id: string, nombre: string }[];
    if (!recipe) { throw new Error(`No hay ninguna receta de tipo ${tipo} en el catálogo para sembrar el fixture.`); }
    recipesByTipo[tipo] = recipe;
  }

  const planRes = await request.post(`${supabaseUrl()}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: { user_id: testUser.id, semana_iso: semanaIso, fecha_inicio: fechaInicio, advertencias: [] },
  });
  if (!planRes.ok()) { throw new Error(`Failed to seed meal_plans: ${planRes.status()} ${await planRes.text()}`); }
  const [plan] = await planRes.json() as { id: string }[];

  const slots = DIAS.flatMap(dia => TIPOS.map(tipo => ({
    meal_plan_id: plan.id,
    recipe_id: recipesByTipo[tipo].id,
    dia,
    tipo_plato: tipo,
  })));
  const slotsRes = await request.post(`${supabaseUrl()}/rest/v1/meal_plan_recipes`, { headers, data: slots });
  if (!slotsRes.ok()) { throw new Error(`Failed to seed meal_plan_recipes: ${slotsRes.status()} ${await slotsRes.text()}`); }

  return { comidaNombre: recipesByTipo.comida.nombre, cenaNombre: recipesByTipo.cena.nombre };
}

/**
 * Seeds a real "last week, all slots cocinada" plan for `testUser` — the
 * real history `get_recent_recipe_marks()` (2-week window, ADR-0006) needs
 * to find, same fixture `aprendizaje-pro.steps.ts` originally seeded on the
 * shared `PRO_USER_EMAIL` account.
 */
export async function seedLastWeekCookedHistory(request: APIRequestContext, testUser: TestUser): Promise<void> {
  const headers = restHeaders(testUser.accessToken);

  const recipesRes = await request.get(`${supabaseUrl()}/rest/v1/recipes?select=id&limit=5`, { headers });
  const recipes = await recipesRes.json() as { id: string }[];
  if (recipes.length === 0) { throw new Error('No recipes available in the catalog to seed the fixture.'); }

  const lastMonday = mondayOfWeekContaining(new Date());
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  const lastWeekPlanRes = await request.post(`${supabaseUrl()}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: {
      user_id: testUser.id,
      semana_iso: isoWeekOf(lastMonday),
      fecha_inicio: lastMonday.toISOString().slice(0, 10),
      advertencias: [],
    },
  });
  if (!lastWeekPlanRes.ok()) {
    throw new Error(`Failed to seed last week's meal_plans: ${lastWeekPlanRes.status()} ${await lastWeekPlanRes.text()}`);
  }
  const [lastWeekPlan] = await lastWeekPlanRes.json() as { id: string }[];

  const lastWeekSlots = DIAS.flatMap((dia, dIdx) => TIPOS.map(tipo => ({
    meal_plan_id: lastWeekPlan.id,
    recipe_id: recipes[dIdx % recipes.length].id,
    dia,
    tipo_plato: tipo,
    estado: 'cocinada' as const,
  })));
  const seedRes = await request.post(`${supabaseUrl()}/rest/v1/meal_plan_recipes`, { headers, data: lastWeekSlots });
  if (!seedRes.ok()) { throw new Error(`Failed to seed last week's history: ${seedRes.status()} ${await seedRes.text()}`); }
}

/**
 * Real, deterministic (no Gemini call, ADR-0005/ADR-0006) generation of
 * `testUser`'s CURRENT week plan via the real `generate-meal-plan` edge
 * function — used wherever a scenario needs a real menu to exist (e.g. before
 * `/shopping-list` will offer "Generar lista de la compra") without caring
 * about its exact contents.
 */
export async function generateCurrentWeekPlan(request: APIRequestContext, testUser: TestUser, options: { timeoutMs?: number } = {}): Promise<void> {
  const headers = restHeaders(testUser.accessToken);
  const { semanaIso, fechaInicio } = currentWeekMonday();

  const genRes = await request.post(`${supabaseUrl()}/functions/v1/generate-meal-plan`, {
    headers,
    data: { semana_iso: semanaIso, fecha_inicio: fechaInicio },
    timeout: options.timeoutMs ?? 120_000,
  });
  if (!genRes.ok()) { throw new Error(`generate-meal-plan failed: ${genRes.status()} ${await genRes.text()}`); }
}
