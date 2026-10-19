import type { PostgrestError } from '@supabase/supabase-js'
import type { DataISO } from '@/lib/dominio/datas'
import { dataEmPalmas, intervaloUTC, type Periodo } from '@/lib/dominio/periodo'
import {
  contarConversao,
  contarMotivos,
  quebrarConversao,
  resumirRecebimentos,
  resumirVendas,
  type ContagemConversao,
  type ContratoRelatorio,
  type EventoRelatorio,
  type ResumoVendas,
} from '@/lib/dominio/relatorios'
import type { StatusCobranca, TipoValor } from '@/lib/dominio/tipos'
import { listarOpcoes } from './config'
import { listarContratos, mrrAtivo } from './contratos'
import { lerTodas } from './paginacao'
import type { SupabaseClient } from './tipos'

export interface FiltrosRelatorio {
  nichoId: string | null
  origemId: string | null
}

type Grupo = { nome: string; contagem: ContagemConversao }
type Pagina<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>

const TIPOS_CONVERSAO = ['mvp_enviado', 'retorno_feito', 'etapa_alterada', 'proposta_enviada', 'proposta_aceita']

interface LinhaEvento {
  id: string
  lead_id: string
  tipo: string
  dados: Record<string, unknown> | null
  ocorrido_em: string
  leads: { nicho_id: string | null; origem_id: string | null }
}

/** Grupos na ordem das opções, "Sem ..." por último; grupo sem eventos não aparece. */
function agrupar(
  eventos: EventoRelatorio[],
  grupoDoLead: (leadId: string) => string | null,
  opcoes: { id: string; nome: string }[],
  semNome: string,
): Grupo[] {
  const mapa = quebrarConversao(eventos, grupoDoLead)
  const grupos: Grupo[] = []
  for (const o of opcoes) {
    const contagem = mapa.get(o.id)
    if (contagem) grupos.push({ nome: o.nome, contagem })
  }
  const sem = mapa.get(null)
  if (sem) grupos.push({ nome: semNome, contagem: sem })
  return grupos
}

export async function relatorioConversao(
  db: SupabaseClient,
  periodo: Periodo,
  filtros: FiltrosRelatorio,
): Promise<{ total: ContagemConversao; porNicho: Grupo[]; porOrigem: Grupo[] }> {
  const { inicio, fim } = intervaloUTC(periodo)
  const linhas = await lerTodas<LinhaEvento>((de, ate) => {
    let q = db
      .from('eventos')
      .select('id, lead_id, tipo, dados, ocorrido_em, leads!inner(nicho_id, origem_id)')
      .in('tipo', TIPOS_CONVERSAO)
      .gte('ocorrido_em', inicio)
      .lt('ocorrido_em', fim)
    if (filtros.nichoId) q = q.eq('leads.nicho_id', filtros.nichoId)
    if (filtros.origemId) q = q.eq('leads.origem_id', filtros.origemId)
    return q.order('ocorrido_em').order('id').range(de, ate) as unknown as Pagina<LinhaEvento>
  }, 'Falha ao ler eventos do relatório')

  const eventos: EventoRelatorio[] = linhas.map((l) => ({ leadId: l.lead_id, tipo: l.tipo, dados: l.dados }))
  const nichoDoLead = new Map<string, string | null>()
  const origemDoLead = new Map<string, string | null>()
  for (const l of linhas) {
    nichoDoLead.set(l.lead_id, l.leads.nicho_id)
    origemDoLead.set(l.lead_id, l.leads.origem_id)
  }
  const [nichos, origens] = await Promise.all([
    listarOpcoes(db, 'nicho', [...nichoDoLead.values()]),
    listarOpcoes(db, 'origem', [...origemDoLead.values()]),
  ])
  return {
    total: contarConversao(eventos),
    porNicho: agrupar(eventos, (id) => nichoDoLead.get(id) ?? null, nichos, 'Sem nicho'),
    porOrigem: agrupar(eventos, (id) => origemDoLead.get(id) ?? null, origens, 'Sem origem'),
  }
}

interface LinhaContrato {
  id: string
  lead_id: string
  data_inicio: DataISO
  created_at: string
  contrato_itens: { tipo: TipoValor; valor_centavos: number }[]
  leads: { created_at: string }
}

interface LinhaCobranca {
  id: string
  status: StatusCobranca
  vencimento: DataISO
  valor_centavos: number
  valor_pago_centavos: number | null
}

export async function relatorioFinanceiro(
  db: SupabaseClient,
  periodo: Periodo,
  hoje: DataISO,
): Promise<{ vendas: ResumoVendas; mrrCentavos: number; recebimentos: ReturnType<typeof resumirRecebimentos> }> {
  const contratos = await lerTodas<LinhaContrato>(
    (de, ate) =>
      db
        .from('contratos')
        .select('id, lead_id, data_inicio, created_at, contrato_itens(tipo, valor_centavos), leads(created_at)')
        .order('created_at')
        .order('id')
        .range(de, ate) as unknown as Pagina<LinhaContrato>,
    'Falha ao ler contratos do relatório',
  )

  // D7: primeiro contrato de cada lead por data_inicio e depois created_at.
  const primeiro = new Map<string, LinhaContrato>()
  for (const c of contratos) {
    const atual = primeiro.get(c.lead_id)
    if (
      !atual ||
      c.data_inicio < atual.data_inicio ||
      (c.data_inicio === atual.data_inicio && c.created_at < atual.created_at)
    ) {
      primeiro.set(c.lead_id, c)
    }
  }
  // D5: vendido inclui contratos depois cancelados.
  const doPeriodo: ContratoRelatorio[] = contratos
    .filter((c) => c.data_inicio >= periodo.de && c.data_inicio <= periodo.ate)
    .map((c) => ({
      id: c.id,
      leadId: c.lead_id,
      dataInicio: c.data_inicio,
      leadCriadoEm: dataEmPalmas(c.leads.created_at),
      itens: c.contrato_itens.map((i) => ({ tipo: i.tipo, valorCentavos: Number(i.valor_centavos) })),
    }))
  const vendas = resumirVendas(doPeriodo, (leadId) => primeiro.get(leadId)!.id)

  const mrrCentavos = mrrAtivo(await listarContratos(db, hoje, { status: 'ativo' }))

  const cobrancas = await lerTodas<LinhaCobranca>(
    (de, ate) =>
      db
        .from('cobrancas')
        .select('id, status, vencimento, valor_centavos, valor_pago_centavos')
        .gte('vencimento', periodo.de)
        .lte('vencimento', periodo.ate)
        .order('vencimento')
        .order('id')
        .range(de, ate) as unknown as Pagina<LinhaCobranca>,
    'Falha ao ler cobranças do relatório',
  )
  const recebimentos = resumirRecebimentos(
    cobrancas.map((c) => ({
      status: c.status,
      vencimento: c.vencimento,
      valorCentavos: Number(c.valor_centavos),
      valorPagoCentavos: c.valor_pago_centavos === null ? null : Number(c.valor_pago_centavos),
    })),
    hoje,
  )
  return { vendas, mrrCentavos, recebimentos }
}

interface LinhaPerda {
  id: string
  lead_id: string
  dados: Record<string, unknown> | null
  leads: { motivo_perda_id: string | null }
}

/** Motivos de perda (D10): leads que foram para "perdido" no período e continuam perdidos. */
export async function relatorioMotivos(
  db: SupabaseClient,
  periodo: Periodo,
): Promise<ReturnType<typeof contarMotivos>> {
  const { inicio, fim } = intervaloUTC(periodo)
  const linhas = await lerTodas<LinhaPerda>(
    (de, ate) =>
      db
        .from('eventos')
        .select('id, lead_id, dados, leads!inner(motivo_perda_id)')
        .eq('tipo', 'etapa_alterada')
        .eq('leads.etapa', 'perdido')
        .gte('ocorrido_em', inicio)
        .lt('ocorrido_em', fim)
        .order('id')
        .range(de, ate) as unknown as Pagina<LinhaPerda>,
    'Falha ao ler perdas do relatório',
  )
  const porLead = new Map<string, string | null>()
  for (const l of linhas) {
    if (l.dados?.para === 'perdido') porLead.set(l.lead_id, l.leads.motivo_perda_id)
  }
  const motivos = [...porLead.values()]
  const opcoes = await listarOpcoes(db, 'motivo_perda', motivos)
  const nomes = new Map(opcoes.map((o) => [o.id, o.nome]))
  return contarMotivos(
    motivos.map((motivoId) => ({ motivoId })),
    (id) => nomes.get(id),
  )
}
