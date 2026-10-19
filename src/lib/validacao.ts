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

/** Mensagem de erro da sequência de prazos (dias), ou null se válida: 1 a 365, crescente, sem repetir. */
export function erroSequencia(seq: number[]): string | null {
  if (seq.length === 0) return 'A sequência de retornos precisa ter ao menos um prazo.'
  if (!seq.every((n) => Number.isInteger(n) && n >= 1 && n <= 365)) {
    return 'Os prazos da sequência devem ser números inteiros positivos (1 a 365 dias).'
  }
  if (!seq.every((n, i) => i === 0 || n > seq[i - 1])) {
    return 'Os prazos da sequência devem estar em ordem crescente, sem repetir.'
  }
  return null
}

/** Hora 'HH:MM' (00:00 a 23:59). */
export function horaValida(h: string): boolean {
  return HORA.test(h)
}

/** Endereço http ou https (bloqueia javascript:, data: etc.). */
export function linkValido(l: string): boolean {
  // O banco exige ^https?:// (leads_link_mvp_ck); 'http:foo.com' parseia mas seria recusado.
  if (!/^https?:\/\//i.test(l)) return false
  try {
    const u = new URL(l)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function emailValido(e: string): boolean {
  return /^\S+@\S+\.\S+$/.test(e)
}
