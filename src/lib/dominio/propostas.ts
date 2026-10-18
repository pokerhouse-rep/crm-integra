import type { Competencia, TipoValor } from './tipos'

export interface Desconto {
  tipo: 'percentual' | 'valor'
  valor: number // percentual em centésimos de %; valor em centavos
}

export interface ItemProposta {
  servicoId: string | null
  descricao: string
  tipo: TipoValor
  valorCentavos: number
  parcelas: number // único: 1 = à vista; recorrente: sempre 1
  mesInicio: Competencia | null // obrigatório se recorrente
  desconto: Desconto | null
}

export function descontoDoItem(item: ItemProposta): number {
  if (!item.desconto) return 0
  if (item.desconto.tipo === 'percentual') return Math.round((item.valorCentavos * item.desconto.valor) / 10000)
  return item.desconto.valor
}

export function valorLiquido(item: ItemProposta): number {
  return item.valorCentavos - descontoDoItem(item)
}

export function totaisProposta(itens: ItemProposta[]): {
  unicoCentavos: number
  recorrenteCentavos: number
  descontoCentavos: number
} {
  const t = { unicoCentavos: 0, recorrenteCentavos: 0, descontoCentavos: 0 }
  for (const i of itens) {
    if (i.tipo === 'unico') t.unicoCentavos += valorLiquido(i)
    else t.recorrenteCentavos += valorLiquido(i)
    t.descontoCentavos += descontoDoItem(i)
  }
  return t
}

// P6: parte inteira para todas; o que sobra vai para a 1ª parcela.
export function dividirParcelas(totalCentavos: number, n: number): number[] {
  const base = Math.floor(totalCentavos / n)
  const sobra = totalCentavos - base * n
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + sobra : base))
}

export function validarItem(item: ItemProposta): string | null {
  if (item.descricao.trim() === '') return 'Informe a descrição do item.'
  if (!Number.isInteger(item.valorCentavos) || item.valorCentavos <= 0) return 'O valor do item deve ser maior que zero.'
  if (item.tipo === 'unico' && (!Number.isInteger(item.parcelas) || item.parcelas < 1 || item.parcelas > 48)) {
    return 'O número de parcelas deve ser de 1 a 48.'
  }
  if (item.tipo === 'recorrente' && !item.mesInicio) return 'Informe o mês de início da mensalidade.'
  if (item.desconto && item.desconto.valor <= 0) return 'O desconto deve ser maior que zero.'
  if (valorLiquido(item) <= 0) return 'O desconto deve ser menor que o valor do item.'
  return null
}
