/** Validadores compartilhados pelas server actions e páginas (módulo puro, sem 'use server'). */

export type RespostaAcao = { erro?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export function uuidValido(v: string): boolean {
  return UUID.test(v)
}

/** Data 'YYYY-MM-DD' que existe no calendário. */
export function dataValida(d: string): boolean {
  if (!DATA_ISO.test(d)) return false
  const x = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d
}

/** Hora 'HH:MM' (00:00 a 23:59). */
export function horaValida(h: string): boolean {
  return HORA.test(h)
}
