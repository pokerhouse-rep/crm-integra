const LIMITE_CENTAVOS = 1_000_000_000

export function formatarReais(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(centavos / 100)
    .replace(/\u00a0/g, ' ')
}

export function lerReais(texto: string): number | null {
  const t = texto.replace(/R\$/g, '').replace(/\s+/g, '')
  if (t === '' || !/^[\d.,]+$/.test(t)) return null

  let inteiro: string
  let centavos: string
  const virgulas = t.split(',').length - 1

  if (virgulas > 1) return null
  if (virgulas === 1) {
    const [antes, depois] = t.split(',')
    if (!/^\d{1,2}$/.test(depois)) return null
    if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(antes)) return null
    inteiro = antes.replace(/\./g, '')
    centavos = depois.padEnd(2, '0')
  } else {
    const decimal = /^(\d+)\.(\d{1,2})$/.exec(t)
    if (decimal) {
      inteiro = decimal[1]
      centavos = decimal[2].padEnd(2, '0')
    } else {
      if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(t)) return null
      inteiro = t.replace(/\./g, '')
      centavos = '00'
    }
  }

  const total = Number(inteiro) * 100 + Number(centavos)
  if (!Number.isSafeInteger(total) || total > LIMITE_CENTAVOS) return null
  return total
}

export function lerPercentual(texto: string): number | null {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(texto.replace(/%/g, '').trim())
  if (!m) return null
  const total = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0')
  return total > 10000 ? null : total
}

export function formatarPercentual(centesimos: number): string {
  const inteiro = Math.floor(centesimos / 100)
  const frac = String(centesimos % 100).padStart(2, '0').replace(/0$/, '')
  return frac === '' || frac === '0' ? `${inteiro}%` : `${inteiro},${frac}%`
}

export function formatarValorNegociacao(v: { unicoCentavos: number; recorrenteCentavos: number }): string {
  const partes: string[] = []
  if (v.unicoCentavos > 0) partes.push(formatarReais(v.unicoCentavos))
  if (v.recorrenteCentavos > 0) partes.push(`${formatarReais(v.recorrenteCentavos)}/mês`)
  return partes.join(' + ')
}
