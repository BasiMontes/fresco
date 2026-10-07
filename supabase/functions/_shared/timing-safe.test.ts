import { describe, expect, it } from 'bun:test'
import { timingSafeEqual } from './timing-safe.ts'

describe('timingSafeEqual', () => {
  it('is true for identical strings, including non-ASCII ones', () => {
    expect(timingSafeEqual('sb_secret_abc123', 'sb_secret_abc123')).toBe(true)
    expect(timingSafeEqual('contraseña-ñ', 'contraseña-ñ')).toBe(true)
    expect(timingSafeEqual('', '')).toBe(true)
  })

  it('is false when one byte differs, wherever it sits', () => {
    expect(timingSafeEqual('sb_secret_abc123', 'Xb_secret_abc123')).toBe(false)
    expect(timingSafeEqual('sb_secret_abc123', 'sb_secret_abc12X')).toBe(false)
  })

  it('is false for a prefix, an extension and an empty guess', () => {
    expect(timingSafeEqual('sb_secret_abc123', 'sb_secret')).toBe(false)
    expect(timingSafeEqual('sb_secret', 'sb_secret_abc123')).toBe(false)
    expect(timingSafeEqual('sb_secret_abc123', '')).toBe(false)
  })
})
