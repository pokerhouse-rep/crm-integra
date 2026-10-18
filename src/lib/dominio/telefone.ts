/** Normaliza para 55 + DDD + número (só dígitos). Retorna null se inválido. */
export function normalizarTelefone(entrada: string): string | null {
  const d = entrada.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  return null
}

/** '5563999990000' → '(63) 99999-0000'; fixo: '(63) 3214-0000'. */
export function formatarTelefone(normalizado: string): string {
  const local = normalizado.startsWith('55') ? normalizado.slice(2) : normalizado
  const ddd = local.slice(0, 2)
  const num = local.slice(2)
  const corte = num.length - 4
  return `(${ddd}) ${num.slice(0, corte)}-${num.slice(corte)}`
}
