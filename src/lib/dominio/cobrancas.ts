import { formatarDataBR, somarDias, type DataISO } from './datas'
import { formatarReais } from './dinheiro'
import { dividirParcelas } from './propostas'
import type { Competencia, StatusCobranca, TipoCobranca, TipoValor } from './tipos'

const dois = (n: number) => String(n).padStart(2, '0')

export function competenciaDe(data: DataISO): Competencia {
  return `${data.slice(0, 7)}-01`
}

export function somarMeses(c: Competencia, n: number): Competencia {
  const [a, m] = c.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-01`
}

export function vencimentoNaCompetencia(c: Competencia, dia: number): DataISO {
  return `${c.slice(0, 8)}${dois(dia)}`
}

// P7: mês seguinte ao de hoje.
export function horizonteCobrancas(hoje: DataISO): Competencia {
  return somarMeses(competenciaDe(hoje), 1)
}

export function diaVencimentoPadrao(hoje: DataISO): number {
  return Math.min(Number(hoje.slice(8, 10)), 28)
}

export interface ItemContratado {
  tipo: TipoValor
  valorCentavos: number // líquido
  parcelas: number
  mesInicio: Competencia | null
}

export interface CobrancaPlanejada {
  itemIndice: number
  tipo: TipoCobranca
  numero: number | null
  totalParcelas: number | null
  competencia: Competencia | null
  vencimento: DataISO
  valorCentavos: number
}

export function competenciasFaltantes(mesInicio: Competencia, ate: Competencia, existentes: Competencia[]): Competencia[] {
  const tem = new Set(existentes)
  const faltantes: Competencia[] = []
  for (let c = mesInicio; c <= ate; c = somarMeses(c, 1)) {
    if (!tem.has(c)) faltantes.push(c)
  }
  return faltantes
}

export function planejarCobrancasIniciais(
  itens: ItemContratado[],
  o: { diaVencimento: number; primeiroVencimento: DataISO; ate: Competencia },
): CobrancaPlanejada[] {
  const saida: CobrancaPlanejada[] = []
  itens.forEach((item, itemIndice) => {
    if (item.tipo === 'recorrente') {
      if (!item.mesInicio) return
      for (const c of competenciasFaltantes(item.mesInicio, o.ate, [])) {
        saida.push({
          itemIndice, tipo: 'mensalidade', numero: null, totalParcelas: null, competencia: c,
          vencimento: vencimentoNaCompetencia(c, o.diaVencimento), valorCentavos: item.valorCentavos,
        })
      }
      return
    }
    if (item.parcelas <= 1) {
      saida.push({
        itemIndice, tipo: 'avista', numero: null, totalParcelas: null, competencia: null,
        vencimento: o.primeiroVencimento, valorCentavos: item.valorCentavos,
      })
      return
    }
    const base = competenciaDe(o.primeiroVencimento)
    dividirParcelas(item.valorCentavos, item.parcelas).forEach((valorCentavos, i) => {
      const k = i + 1
      saida.push({
        itemIndice, tipo: 'parcela', numero: k, totalParcelas: item.parcelas, competencia: null,
        vencimento: k === 1 ? o.primeiroVencimento : vencimentoNaCompetencia(somarMeses(base, k - 1), o.diaVencimento),
        valorCentavos,
      })
    })
  })
  return saida
}

export function valorVigente(
  valorBase: number,
  reajustes: { aPartirDe: Competencia; valorCentavos: number }[],
  c: Competencia,
): number {
  let vigente: { aPartirDe: Competencia; valorCentavos: number } | null = null
  for (const r of reajustes) {
    if (r.aPartirDe <= c && (!vigente || r.aPartirDe > vigente.aPartirDe)) vigente = r
  }
  return vigente ? vigente.valorCentavos : valorBase
}

/** Espelha `desfazer_pagamento`: pagamento de contrato cancelado com vencimento a partir do cancelamento não volta. */
export function podeDesfazerPagamento(
  c: { vencimento: DataISO },
  contrato: { status: 'ativo' | 'pausado' | 'cancelado'; canceladoEm: DataISO | null },
): boolean {
  return !(contrato.status === 'cancelado' && contrato.canceladoEm !== null && c.vencimento >= contrato.canceladoEm)
}

export function situacaoCobranca(
  c: { status: StatusCobranca; vencimento: DataISO },
  hoje: DataISO,
  diasLembrete: number,
): 'paga' | 'suspensa' | 'atrasada' | 'vencendo' | 'futura' {
  if (c.status === 'paga') return 'paga'
  if (c.status === 'suspensa') return 'suspensa'
  if (c.vencimento < hoje) return 'atrasada'
  if (c.vencimento <= somarDias(hoje, diasLembrete)) return 'vencendo'
  return 'futura'
}

export function resumirMes(
  cs: { status: StatusCobranca; valorCentavos: number; valorPagoCentavos: number | null }[],
): { previstoCentavos: number; recebidoCentavos: number; aReceberCentavos: number } {
  const r = { previstoCentavos: 0, recebidoCentavos: 0, aReceberCentavos: 0 }
  for (const c of cs) {
    if (c.status !== 'suspensa') r.previstoCentavos += c.valorCentavos
    if (c.status === 'paga') r.recebidoCentavos += c.valorPagoCentavos ?? 0
    if (c.status === 'aberta') r.aReceberCentavos += c.valorCentavos
  }
  return r
}

export function rotuloCobranca(c: {
  descricaoItem: string
  tipo: TipoCobranca
  numero: number | null
  totalParcelas: number | null
  competencia: Competencia | null
}): string {
  if (c.tipo === 'avista') return `${c.descricaoItem} · à vista`
  if (c.tipo === 'parcela') return `${c.descricaoItem} · parcela ${c.numero} de ${c.totalParcelas}`
  const mes = c.competencia ? `${c.competencia.slice(5, 7)}/${c.competencia.slice(0, 4)}` : ''
  return `${c.descricaoItem} · mensalidade ${mes}`
}

export function mensagemCobranca(
  c: { nome: string; rotulo: string; valorCentavos: number; vencimento: DataISO },
  hoje: DataISO,
): string {
  const valor = formatarReais(c.valorCentavos)
  const data = formatarDataBR(c.vencimento)
  if (c.vencimento < hoje) {
    return `Olá ${c.nome}! O pagamento de ${c.rotulo}, no valor de ${valor}, venceu em ${data}. Consegue verificar para mim? Qualquer dúvida, estou à disposição.`
  }
  return `Olá ${c.nome}! Passando para lembrar do pagamento de ${c.rotulo}, no valor de ${valor}, com vencimento em ${data}. Qualquer dúvida, estou à disposição.`
}
