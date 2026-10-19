import { describe, expect, test } from 'bun:test'
import { semanaActualMadrid } from './week.ts'

/** FRESCO-1014: the current week is the one it is in Madrid, not in UTC. */
describe('semanaActualMadrid', () => {
  test('a Wednesday is in its own week', () => {
    expect(semanaActualMadrid(new Date('2026-10-21T10:00:00Z'))).toBe('2026-W43')
  })

  test('Sunday 23:30 UTC is already Monday in Madrid: the next week', () => {
    // 2026-10-18 is a Sunday (W42); 23:30Z is 01:30 on Monday the 19th in Madrid (CEST, UTC+2).
    expect(semanaActualMadrid(new Date('2026-10-18T23:30:00Z'))).toBe('2026-W43')
    expect(semanaActualMadrid(new Date('2026-10-18T21:30:00Z'))).toBe('2026-W42')
  })

  test('the last days of a 53-week year and the first of the next', () => {
    expect(semanaActualMadrid(new Date('2026-12-31T12:00:00Z'))).toBe('2026-W53')
    expect(semanaActualMadrid(new Date('2027-01-04T12:00:00Z'))).toBe('2027-W01')
  })
})
