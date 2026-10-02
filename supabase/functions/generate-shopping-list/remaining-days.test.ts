import type { DiaSemana } from './types.ts'
import { describe, expect, test } from 'bun:test'
import { filtrarDiasVigentes, hoyEnMadrid } from './remaining-days.ts'

const SEMANA: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
// Monday 28 Sep 2026 is the plan's first day; 2 Oct 2026 is the Friday of FRESCO-807.
const LUNES = '2026-09-28'
const slots = SEMANA.flatMap(dia => [{ dia, tipo: 'comida' }, { dia, tipo: 'cena' }])

describe('filtrarDiasVigentes', () => {
  test('on a Friday only Friday, Saturday and Sunday remain (FRESCO-807)', () => {
    const resultado = filtrarDiasVigentes({ slots, fechaInicio: LUNES, hoy: '2026-10-02' })
    expect([...new Set(resultado.map(s => s.dia))]).toEqual(['viernes', 'sabado', 'domingo'])
    expect(resultado).toHaveLength(6)
  })

  test('today itself still counts', () => {
    const resultado = filtrarDiasVigentes({ slots, fechaInicio: LUNES, hoy: '2026-09-30' })
    expect(resultado[0].dia).toBe('miercoles')
  })

  test('on Monday the whole week stays', () => {
    expect(filtrarDiasVigentes({ slots, fechaInicio: LUNES, hoy: LUNES })).toHaveLength(slots.length)
  })

  test('a plan for a future week keeps every slot', () => {
    expect(filtrarDiasVigentes({ slots, fechaInicio: '2026-10-05', hoy: '2026-10-02' })).toHaveLength(slots.length)
  })

  test('a plan for a week that is over keeps every slot instead of an empty list', () => {
    expect(filtrarDiasVigentes({ slots, fechaInicio: '2026-09-14', hoy: '2026-10-02' })).toHaveLength(slots.length)
  })

  test('works across a month boundary', () => {
    const resultado = filtrarDiasVigentes({ slots, fechaInicio: '2026-09-28', hoy: '2026-10-04' })
    expect([...new Set(resultado.map(s => s.dia))]).toEqual(['domingo'])
  })
})

describe('hoyEnMadrid', () => {
  test('uses the Madrid date, not UTC, just after local midnight', () => {
    // 22:30 UTC on 1 Oct is 00:30 on 2 Oct in Madrid (CEST, UTC+2).
    expect(hoyEnMadrid(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02')
  })

  test('same instant earlier in the evening is still the previous day', () => {
    expect(hoyEnMadrid(new Date('2026-10-01T21:30:00Z'))).toBe('2026-10-01')
  })
})
