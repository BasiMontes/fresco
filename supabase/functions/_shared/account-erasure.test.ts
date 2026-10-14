import { describe, expect, test } from 'bun:test'
import { fakeEdgeClient } from '@/tests/mocks/edge-function'
import { recordAccountErasure, sha256Hex } from './account-erasure.ts'

/**
 * FRESCO-910 (audit C-06) — the erasure record keeps a hash of the user id, never the id,
 * except for a PostHog deletion that failed and has to be retried.
 */

type Client = Parameters<typeof recordAccountErasure>[0]

describe('sha256Hex', () => {
  test('matches the published SHA-256 vector for "abc"', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('recordAccountErasure', () => {
  test('stores the hash, not the id, and no pending id when PostHog was handled', async () => {
    const db = fakeEdgeClient()

    await recordAccountErasure(db.client as Client, { userId: 'user_1', stripe: 'cancelled', posthog: 'deleted' })

    expect(db.inserts).toEqual([['account_erasures', {
      user_hash: await sha256Hex('user_1'),
      stripe: 'cancelled',
      posthog: 'deleted',
      pending_posthog_distinct_id: null,
    }]])
    expect(JSON.stringify(db.inserts)).not.toContain('"user_1"')
  })

  test('keeps the id, and only the id, when the PostHog deletion failed', async () => {
    const db = fakeEdgeClient()

    await recordAccountErasure(db.client as Client, { userId: 'user_1', stripe: 'none', posthog: 'failed' })

    expect(db.inserts[0]?.[1]).toMatchObject({ posthog: 'failed', pending_posthog_distinct_id: 'user_1' })
  })

  test('throws on a write error so the caller can log it', async () => {
    const db = fakeEdgeClient({ insertError: { account_erasures: new Error('insert denied') } })

    await expect(recordAccountErasure(db.client as Client, { userId: 'user_1', stripe: 'none', posthog: 'deleted' })).rejects.toThrow('insert denied')
  })
})
