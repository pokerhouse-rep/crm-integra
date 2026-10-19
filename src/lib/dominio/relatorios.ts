import type { StatusCobranca, TipoValor } from './tipos'
import type { DataISO } from './datas'
import { resumirMes } from './cobrancas'

export interface EventoRelatorio {
  leadId: string
  tipo: string
  dados: Record<string, unknown> | null
}

export type EtapaConversao = 'mvp' | 'resposta' | 'proposta' | 'fechamento'

/** Etapa do funil de conversão a que o evento pertence (D1), ou null. */
export function etapaDoEvento(e: EventoRelatorio): EtapaConversao | null {
  if (e.tipo === 'mvp_enviado') return 'mvp'
  if (e.tipo === 'proposta_enviada') return 'proposta'
  if (e.tipo === 'proposta_aceita') return 'fechamento'
  if (e.tipo === 'retorno_feito' && e.dados?.resultado === 'respondeu') return 'resposta'
  if (e.tipo === 'etapa_alterada') {
    if (e.dados?.para === 'em_conversa') return 'resposta'
    if (e.dados?.para === 'fechado') return 'fechamento'
  }
  return null
}

export interface ContagemConversao {
  mvp: number
  resposta: number
  proposta: number
  fechamento: number
}

/** Leads distintos por etapa. */
export function contarConversao(eventos: EventoRelatorio[]): ContagemConversao {
  const leads: Record<EtapaConversao, Set<string>> = {
    mvp: new Set(), resposta: new Set(), proposta: new Set(), fechamento: new Set(),
  }
  for (const e of eventos) {
    const etapa = etapaDoEvento(e)
    if (etapa) leads[etapa].add(e.leadId)
  }
  return {
    mvp: leads.mvp.size,
    resposta: leads.resposta.size,
    proposta: leads.proposta.size,
    fechamento: leads.fechamento.size,
  }
}

/** Conversão por grupo (ex.: nicho). Grupos sem eventos não aparecem. */
export function quebrarConversao(
  eventos: EventoRelatorio[],
  grupoDoLead: (leadId: string) => string | null,
): Map<string | null, ContagemConversao> {
  const porGrupo = new Map<string | null, EventoRelatorio[]>()
  for (const e of eventos) {
    const g = grupoDoLead(e.leadId)
    const lista = porGrupo.get(g)
    if (lista) lista.push(e)
    else porGrupo.set(g, [e])
  }
  return new Map([...porGrupo].map(([g, lista]) => [g, contarConversao(lista)]))
}

/** Percentual com uma casa decimal; null se não há base. */
export function taxa(parte: number, todo: number): number | null {
  if (todo === 0) return null
  return Math.round((parte * 1000) / todo) / 10
}

const MS_DIA = 86_400_000

/** Dias corridos entre duas datas ISO (ate - de). */
export function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / MS_DIA)
}

export interface ContratoRelatorio {
  id: string
  leadId: string
  dataInicio: DataISO
  leadCriadoEm: DataISO
  itens: { tipo: TipoValor; valorCentavos: number }[]
}

export interface ResumoVendas {
  contratos: number
  unicoCentavos: number
  mensalCentavos: number
  ticketUnicoCentavos: number | null
  ticketMensalCentavos: number | null
  tempoMedioDias: number | null
}

/** Vendido no período (D5), ticket médio (D6) e tempo até fechar (D7). */
export function resumirVendas(
  doPeriodo: ContratoRelatorio[],
  primeiroContratoDoLead: (leadId: string) => string,
): ResumoVendas {
  let unico = 0
  let mensal = 0
  for (const k of doPeriodo) {
    for (const i of k.itens) {
      if (i.tipo === 'unico') unico += i.valorCentavos
      else mensal += i.valorCentavos
    }
  }
  const n = doPeriodo.length
  // Aceite anterior ao cadastro do lead (cliente antigo cadastrado depois) não entra na média de tempo.
  const primeiros = doPeriodo.filter(
    (k) => k.id === primeiroContratoDoLead(k.leadId) && diasEntre(k.leadCriadoEm, k.dataInicio) >= 0,
  )
  const tempo = primeiros.length
    ? Math.round(primeiros.reduce((s, k) => s + diasEntre(k.leadCriadoEm, k.dataInicio), 0) / primeiros.length)
    : null
  return {
    contratos: n,
    unicoCentavos: unico,
    mensalCentavos: mensal,
    ticketUnicoCentavos: n ? Math.round(unico / n) : null,
    ticketMensalCentavos: n ? Math.round(mensal / n) : null,
    tempoMedioDias: tempo,
  }
}

export function resumirRecebimentos(
  cs: { status: StatusCobranca; vencimento: DataISO; valorCentavos: number; valorPagoCentavos: number | null }[],
  hoje: DataISO,
): { previstoCentavos: number; recebidoCentavos: number; aReceberCentavos: number; atrasadoCentavos: number } {
  const atrasadoCentavos = cs
    .filter((c) => c.status === 'aberta' && c.vencimento < hoje)
    .reduce((s, c) => s + c.valorCentavos, 0)
  return { ...resumirMes(cs), atrasadoCentavos }
}

/** Motivos de perda (D10): agrupados pelo nome, do maior para o menor, depois por nome. */
export function contarMotivos(
  perdidos: { motivoId: string | null }[],
  nomeDoMotivo: (id: string) => string | undefined,
): { nome: string; quantidade: number; percentual: number }[] {
  const porNome = new Map<string, number>()
  for (const p of perdidos) {
    const nome = (p.motivoId && nomeDoMotivo(p.motivoId)) || 'Sem motivo'
    porNome.set(nome, (porNome.get(nome) ?? 0) + 1)
  }
  return [...porNome]
    .map(([nome, quantidade]) => ({ nome, quantidade, percentual: taxa(quantidade, perdidos.length) ?? 0 }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'))
}
