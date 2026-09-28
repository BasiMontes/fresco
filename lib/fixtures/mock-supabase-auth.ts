/**
 * A5-M1 (test-mock dedup) — the `auth.getUser()` mock shape was
 * copy-pasted identically across 5 `createMockClient()` helpers
 * (`lib/api/push-subscriptions.test.ts`, `user-profile.test.ts`,
 * `recipes.test.ts`, `meal-plan.test.ts`, `lib/menu/get-spend-trend.test.ts`).
 * Each file's `from()`/`rpc()` mock chain stays bespoke (they mock
 * different Supabase calls per the function under test) — only this
 * boilerplate was truly duplicated. No behavior change from the original
 * inline implementations.
 */
export function mockAuthGetUser(userId?: string) {
  return {
    getUser: async () => (
      userId
        ? { data: { user: { id: userId } }, error: null }
        : { data: { user: null }, error: null }
    ),
  };
}
