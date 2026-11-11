import { describe, expect, test } from 'bun:test'
import { getCurrentIsoWeek, getNextIsoWeek } from './iso-week.ts'

/** FRESCO-1180 — the Sunday reminder is about the week that is about to start. */

describe('getNextIsoWeek', () => {
  test.each([
    ['the Sunday of the cron slot', '2026-11-08T18:00:00Z', '2026-W46'],
    ['a Monday', '2026-11-09T09:00:00Z', '2026-W47'],
    ['the Sunday before a 53-week year ends', '2026-12-27T18:00:00Z', '2026-W53'],
    ['the last Sunday of a 53-week year (next is week 1 of the new year)', '2027-01-03T18:00:00Z', '2027-W01'],
    ['an ordinary year end', '2027-12-26T18:00:00Z', '2027-W52'],
  ])('%s: %s -> %s', (_name, iso, expected) => {
    expect(getNextIsoWeek(new Date(iso))).toBe(expected)
  })

  test('is always the week after getCurrentIsoWeek, whatever the weekday', () => {
    const monday = Date.UTC(2026, 10, 9, 12)
    for (let day = 0; day < 7; day++) {
      const date = new Date(monday + day * 86_400_000)
      expect(getNextIsoWeek(date)).toBe(getCurrentIsoWeek(new Date(monday + (day + 7) * 86_400_000)))
      expect(getNextIsoWeek(date)).toBe('2026-W47')
    }
  })
})
