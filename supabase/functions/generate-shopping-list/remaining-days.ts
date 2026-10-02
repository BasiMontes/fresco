// FRESCO-807 — the shopping list sums only the days that still count.
//
// A plan always holds the whole week (21 slots). On a Friday, Monday to
// Thursday are already behind: summing them overcounts the total and suggests
// purchases nobody needs. The menu keeps the full week; only the list skips
// past days.

import type { DiaSemana } from './types.ts'

const DIAS: readonly DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

/** The app is Spain-only: "today" is the date in Madrid, not in the server's UTC. */
export function hoyEnMadrid(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

function sumarDias(fecha: string, dias: number): string {
  const resultado = new Date(`${fecha}T00:00:00Z`)
  resultado.setUTCDate(resultado.getUTCDate() + dias)
  return resultado.toISOString().slice(0, 10)
}

interface FiltrarDiasInput<T extends { dia: DiaSemana }> {
  slots: readonly T[]
  /** Monday of the plan's week, `YYYY-MM-DD` (`meal_plans.fecha_inicio`). */
  fechaInicio: string
  /** Today, `YYYY-MM-DD`. */
  hoy: string
}

/**
 * Keeps the slots whose day is today or later. When nothing remains (a plan
 * for a week already over) it returns every slot: an empty list helps nobody,
 * and that plan was asked for on purpose.
 */
export function filtrarDiasVigentes<T extends { dia: DiaSemana }>(input: FiltrarDiasInput<T>): T[] {
  const { slots, fechaInicio, hoy } = input
  const vigentes = slots.filter(slot => sumarDias(fechaInicio, DIAS.indexOf(slot.dia)) >= hoy)
  return vigentes.length > 0 ? vigentes : [...slots]
}
