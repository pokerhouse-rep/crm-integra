import type { DataISO } from '@/lib/dominio/datas'
import { competenciaDe, valorVigente } from '@/lib/dominio/cobrancas'
import type { Competencia, StatusContrato } from '@/lib/dominio/tipos'
import { cobrancasDoContrato, garantirMensalidades, type CobrancaResumo } from './cobrancas'
import { chamarRpc } from './rpc'
import { ErroNegocio, lancarSeErro, type Contrato, type ContratoItem, type Reajuste, type SupabaseClient } from './tipos'

export interface ContratoResumo extends Contrato {
  lead: { id: string; nome_contato: string; empresa: string | null }
  itens: ContratoItem[]
  mensalidadeVigenteCentavos: number
}

export interface ContratoDetalhe {
  contrato: ContratoResumo
  reajustes: Reajuste[]
  cobrancas: CobrancaResumo[]
}

const SELECT_CONTRATO = '*, leads(id, nome_contato, empresa), contrato_itens(*, reajustes(*))'

type ItemComReajustes = ContratoItem & { reajustes: Reajuste[] }
type LinhaContrato = Contrato & {
  leads: ContratoResumo['lead']
  contrato_itens: ItemComReajustes[]
}

function paraResumo(l: LinhaContrato, hoje: DataISO): { resumo: ContratoResumo; reajustes: Reajuste[] } {
  const { leads, contrato_itens, ...c } = l
  const ordenados = [...contrato_itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const competencia = competenciaDe(hoje)
  let mensalidade = 0
  const reajustes: Reajuste[] = []
  const itens = ordenados.map(({ reajustes: rs, ...item }) => {
    const normalizados = rs.map((r) => ({ ...r, valor_centavos: Number(r.valor_centavos) }))
    reajustes.push(...normalizados)
    const base = Number(item.valor_centavos)
    if (c.status === 'ativo' && item.tipo === 'recorrente' && !!item.mes_inicio && item.mes_inicio <= competencia) {
      mensalidade += valorVigente(
        base,
        normalizados.map((r) => ({ aPartirDe: r.a_partir_de, valorCentavos: r.valor_centavos })),
        competencia,
      )
    }
    return { ...item, valor_centavos: base }
  })
  reajustes.sort((a, b) => a.a_partir_de.localeCompare(b.a_partir_de))
  return { resumo: { ...c, lead: leads, itens, mensalidadeVigenteCentavos: mensalidade }, reajustes }
}

export async function listarContratos(
  db: SupabaseClient,
  hoje: DataISO,
  filtro?: { status?: StatusContrato; leadId?: string },
): Promise<ContratoResumo[]> {
  let consulta = db.from('contratos').select(SELECT_CONTRATO)
  if (filtro?.status) consulta = consulta.eq('status', filtro.status)
  if (filtro?.leadId) consulta = consulta.eq('lead_id', filtro.leadId)
  const { data, error } = await consulta.order('created_at', { ascending: false })
  lancarSeErro(error, 'Falha ao listar contratos')
  return ((data ?? []) as unknown as LinhaContrato[]).map((l) => paraResumo(l, hoje).resumo)
}

export function mrrAtivo(contratos: ContratoResumo[]): number {
  return contratos.reduce((soma, c) => soma + c.mensalidadeVigenteCentavos, 0)
}

export async function obterContrato(db: SupabaseClient, id: string, hoje: DataISO): Promise<ContratoDetalhe> {
  const { data, error } = await db.from('contratos').select(SELECT_CONTRATO).eq('id', id).maybeSingle()
  lancarSeErro(error, 'Falha ao ler contrato')
  if (!data) throw new ErroNegocio('Contrato não encontrado.')
  const { resumo, reajustes } = paraResumo(data as unknown as LinhaContrato, hoje)
  return { contrato: resumo, reajustes, cobrancas: await cobrancasDoContrato(db, id) }
}

export async function pausarContrato(db: SupabaseClient, id: string, hoje: DataISO): Promise<void> {
  await chamarRpc(db, 'pausar_contrato', { p_contrato_id: id, p_hoje: hoje }, 'Falha ao pausar contrato')
}

export async function reativarContrato(db: SupabaseClient, id: string, hoje: DataISO): Promise<void> {
  // Meses que faltam da pausa nascem suspensos (o contrato ainda está pausado); a função SQL aplica a regra P9.
  await garantirMensalidades(db, hoje)
  await chamarRpc(db, 'reativar_contrato', { p_contrato_id: id, p_hoje: hoje }, 'Falha ao reativar contrato')
}

export async function cancelarContrato(db: SupabaseClient, id: string, hoje: DataISO): Promise<void> {
  await chamarRpc(db, 'cancelar_contrato', { p_contrato_id: id, p_hoje: hoje }, 'Falha ao cancelar contrato')
}

export async function reajustarMensalidade(
  db: SupabaseClient,
  itemId: string,
  o: { valorCentavos: number; aPartirDe: Competencia },
): Promise<void> {
  if (!Number.isInteger(o.valorCentavos) || o.valorCentavos <= 0) {
    throw new ErroNegocio('Informe o novo valor da mensalidade.')
  }
  await chamarRpc(
    db,
    'reajustar_item',
    { p_item_id: itemId, p_a_partir_de: o.aPartirDe, p_valor: o.valorCentavos },
    'Falha ao reajustar mensalidade',
  )
}
