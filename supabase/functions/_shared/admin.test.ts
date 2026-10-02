import { afterAll, beforeEach, describe, expect, it } from 'bun:test'

/**
 * FRESCO-782 (audit-6 A6-T2): `requireAdminUser` is the ONLY authorization
 * boundary of `delete-catalog-recipe` (a service-role hard delete), and it had
 * no test. A refactor of the ADMIN_USER_ID parsing could let any authenticated
 * user delete catalog recipes with CI green.
 *
 * `Deno` is a global in the Edge runtime but not under `bun test`, so it is
 * stubbed before the import — same pattern as auth.test.ts.
 */
const originalDeno = (globalThis as { Deno?: unknown }).Deno
let envValues: Record<string, string | undefined> = {}

;(globalThis as { Deno?: unknown }).Deno = {
  env: { get: (key: string) => envValues[key] },
}

afterAll(() => {
  (globalThis as { Deno?: unknown }).Deno = originalDeno
})

const { requireAdminUser } = await import('./admin.ts')

beforeEach(() => {
  envValues = {}
})

describe('requireAdminUser', () => {
  it('allows a user whose id is the only entry in the allowlist', () => {
    envValues.ADMIN_USER_ID = 'admin-1'
    expect(() => requireAdminUser({ id: 'admin-1' })).not.toThrow()
  })

  it('allows any id in a comma-separated list', () => {
    envValues.ADMIN_USER_ID = 'admin-1,admin-2,admin-3'
    expect(() => requireAdminUser({ id: 'admin-2' })).not.toThrow()
    expect(() => requireAdminUser({ id: 'admin-3' })).not.toThrow()
  })

  it('trims whitespace around each id in the list', () => {
    envValues.ADMIN_USER_ID = '  admin-1 ,   admin-2  '
    expect(() => requireAdminUser({ id: 'admin-1' })).not.toThrow()
    expect(() => requireAdminUser({ id: 'admin-2' })).not.toThrow()
  })

  it('throws 403 for a user that is not in the allowlist', () => {
    envValues.ADMIN_USER_ID = 'admin-1,admin-2'
    expect(() => requireAdminUser({ id: 'someone-else' })).toThrow(
      expect.objectContaining({ status: 403 }),
    )
  })

  it('throws 403 when ADMIN_USER_ID is unset', () => {
    expect(() => requireAdminUser({ id: 'admin-1' })).toThrow(
      expect.objectContaining({ status: 403 }),
    )
  })

  it('throws 403 when ADMIN_USER_ID is an empty string', () => {
    envValues.ADMIN_USER_ID = ''
    expect(() => requireAdminUser({ id: 'admin-1' })).toThrow(
      expect.objectContaining({ status: 403 }),
    )
  })

  it('throws 403 when ADMIN_USER_ID is only whitespace and commas', () => {
    envValues.ADMIN_USER_ID = ' , ,  '
    expect(() => requireAdminUser({ id: '' })).toThrow(
      expect.objectContaining({ status: 403 }),
    )
    expect(() => requireAdminUser({ id: 'admin-1' })).toThrow(
      expect.objectContaining({ status: 403 }),
    )
  })

  it('does not match on a substring of an allowlisted id', () => {
    envValues.ADMIN_USER_ID = 'admin-12345'
    expect(() => requireAdminUser({ id: 'admin-1' })).toThrow(
      expect.objectContaining({ status: 403 }),
    )
  })
})
