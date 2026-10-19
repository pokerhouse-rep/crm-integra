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
