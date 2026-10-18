/** Conversão dos campos de texto do editor de itens para o domínio (módulo puro, usado por cliente e servidor). */
import { lerPercentual, lerReais, reaisParaCampo } from '@/lib/dominio/dinheiro'
import type { ItemProposta } from '@/lib/dominio/propostas'
import type { TipoValor } from '@/lib/dominio/tipos'

export interface ValoresItem {
  servicoId: string
  descricao: string
  tipo: string
  valor: string
  parcelas: string
  mesInicio: string // 'YYYY-MM'
  descontoTipo: '' | 'percentual' | 'valor'
  desconto: string
}

/** Converte um item; devolve o texto do erro (já com o prefixo "Item N:") quando inválido. */
export function converterItem(v: ValoresItem, n: number): { item: ItemProposta } | { erro: string } {
  const invalido = { erro: `Item ${n}: valor inválido.` }
  if (v.tipo !== 'unico' && v.tipo !== 'recorrente') return { erro: `Item ${n}: tipo inválido.` }
  const tipo: TipoValor = v.tipo
  const valorCentavos = lerReais(v.valor)
  if (valorCentavos === null) return invalido

  let desconto: ItemProposta['desconto'] = null
  if (v.descontoTipo === 'percentual' || v.descontoTipo === 'valor') {
    const d = v.descontoTipo === 'percentual' ? lerPercentual(v.desconto) : lerReais(v.desconto)
    if (d === null) return invalido
    desconto = { tipo: v.descontoTipo, valor: d }
  }

  let parcelas = 1
  if (tipo === 'unico') {
    if (!/^\d{1,3}$/.test(v.parcelas.trim())) return { erro: `Item ${n}: número de parcelas inválido.` }
    parcelas = Number(v.parcelas.trim())
  }

  let mesInicio: string | null = null
  if (tipo === 'recorrente' && v.mesInicio.trim() !== '') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v.mesInicio.trim())) return { erro: `Item ${n}: mês de início inválido.` }
    mesInicio = `${v.mesInicio.trim()}-01`
  }

  return {
    item: {
      servicoId: v.servicoId || null,
      descricao: v.descricao,
      tipo,
      valorCentavos,
      parcelas,
      mesInicio,
      desconto,
    },
  }
}

export function converterItens(valores: ValoresItem[]): { itens: ItemProposta[] } | { erro: string } {
  const itens: ItemProposta[] = []
  for (let i = 0; i < valores.length; i++) {
    const r = converterItem(valores[i], i + 1)
    if ('erro' in r) return r
    itens.push(r.item)
  }
  return { itens }
}

export function itemParaValores(i: ItemProposta): ValoresItem {
  return {
    servicoId: i.servicoId ?? '',
    descricao: i.descricao,
    tipo: i.tipo,
    valor: reaisParaCampo(i.valorCentavos),
    parcelas: String(i.parcelas),
    mesInicio: i.mesInicio ? i.mesInicio.slice(0, 7) : '',
    descontoTipo: i.desconto?.tipo ?? '',
    desconto: i.desconto ? reaisParaCampo(i.desconto.valor) : '',
  }
}
