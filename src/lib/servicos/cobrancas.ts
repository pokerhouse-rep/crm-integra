import { somarDias, type DataISO } from '@/lib/dominio/datas'
import {
  competenciaDe,
  competenciasFaltantes,
  horizonteCobrancas,
  rotuloCobranca,
  situacaoCobranca,
  somarMeses,
  valorVigente,
  vencimentoNaCompetencia,
} from '@/lib/dominio/cobrancas'
import { obterConfig } from './config'
import { chamarRpc } from './rpc'
import { ErroNegocio, lancarSeErro, type Cobranca, type SupabaseClient } from './tipos'

export interface CobrancaResumo extends Cobranca {
  rotulo: string
  lead: { id: string; nome_contato: string; empresa: string | null; whatsapp: string }
  contratoDescricao: string
}

const SELECT_RESUMO =
  '*, contrato_itens(descricao), contratos(descricao), leads(id, nome_contato, empresa, whatsapp)'

type LinhaResumo = Cobranca & {
  contrato_itens: { descricao: string }
  contratos: { descricao: string }
  leads: CobrancaResumo['lead']
}

function paraResumo(l: LinhaResumo): CobrancaResumo {
  const { contrato_itens, contratos, leads, ...c } = l
  return {
    ...c,
    valor_centavos: Number(c.valor_centavos),
    valor_pago_centavos: c.valor_pago_centavos === null ? null : Number(c.valor_pago_centavos),
    rotulo: rotuloCobranca({
      descricaoItem: contrato_itens.descricao,
      tipo: c.tipo,
      numero: c.numero,
      totalParcelas: c.total_parcelas,
      competencia: c.competencia,
    }),
    lead: leads,
    contratoDescricao: contratos.descricao,
  }
}

/** Cria as mensalidades que faltam até o horizonte (P7). Idempotente: duplicatas são ignoradas pelo banco. */
export async function garantirMensalidades(db: SupabaseClient, hoje: DataISO): Promise<number> {
  const ate = horizonteCobrancas(hoje)
  const { data, error } = await db
    .from('contrato_itens')
    .select(
      'id, contrato_id, valor_centavos, mes_inicio, contratos!inner(status, dia_vencimento, lead_id), reajustes(a_partir_de, valor_centavos), cobrancas(competencia)',
    )
    .eq('tipo', 'recorrente')
    .in('contratos.status', ['ativo', 'pausado'])
  lancarSeErro(error, 'Falha ao ler itens recorrentes')

  const novas: Record<string, unknown>[] = []
  for (const item of (data ?? []) as unknown as {
    id: string
    contrato_id: string
    valor_centavos: number
    mes_inicio: string | null
    contratos: { status: 'ativo' | 'pausado'; dia_vencimento: number; lead_id: string }
    reajustes: { a_partir_de: string; valor_centavos: number }[]
    cobrancas: { competencia: string | null }[]
  }[]) {
    if (!item.mes_inicio) continue
    const existentes = item.cobrancas.map((c) => c.competencia).filter((c): c is string => !!c)
    const reajustes = item.reajustes.map((r) => ({ aPartirDe: r.a_partir_de, valorCentavos: Number(r.valor_centavos) }))
    for (const c of competenciasFaltantes(item.mes_inicio, ate, existentes)) {
      novas.push({
        contrato_id: item.contrato_id,
        contrato_item_id: item.id,
        lead_id: item.contratos.lead_id,
        tipo: 'mensalidade',
        competencia: c,
        vencimento: vencimentoNaCompetencia(c, item.contratos.dia_vencimento),
        valor_centavos: valorVigente(Number(item.valor_centavos), reajustes, c),
        status: item.contratos.status === 'ativo' ? 'aberta' : 'suspensa',
      })
    }
  }
  if (novas.length === 0) return 0

  const { data: criadas, error: e2 } = await db
    .from('cobrancas')
    .upsert(novas, { onConflict: 'contrato_item_id,competencia', ignoreDuplicates: true })
    .select('id')
  lancarSeErro(e2, 'Falha ao criar mensalidades')
  return criadas?.length ?? 0
}

export async function cobrancasDoPainel(
  db: SupabaseClient,
  hoje: DataISO,
): Promise<{ atrasadas: CobrancaResumo[]; vencendo: CobrancaResumo[] }> {
  const config = await obterConfig(db)
  const { data, error } = await db
    .from('cobrancas')
    .select(SELECT_RESUMO)
    .eq('status', 'aberta')
    .lte('vencimento', somarDias(hoje, config.diasLembreteCobranca))
    .order('vencimento')
    .order('created_at')
  lancarSeErro(error, 'Falha ao ler cobranças do painel')
  const saida = { atrasadas: [] as CobrancaResumo[], vencendo: [] as CobrancaResumo[] }
  for (const l of (data ?? []) as unknown as LinhaResumo[]) {
    const situacao = situacaoCobranca({ status: l.status, vencimento: l.vencimento }, hoje, config.diasLembreteCobranca)
    if (situacao === 'atrasada') saida.atrasadas.push(paraResumo(l))
    else if (situacao === 'vencendo') saida.vencendo.push(paraResumo(l))
  }
  return saida
}

export async function listarCobrancas(
  db: SupabaseClient,
  filtro: { mes: string } | { atrasadas: true },
  hoje: DataISO,
): Promise<CobrancaResumo[]> {
  let consulta = db.from('cobrancas').select(SELECT_RESUMO)
  if ('mes' in filtro) {
    const inicio = `${filtro.mes}-01`
    consulta = consulta.gte('vencimento', inicio).lt('vencimento', somarMeses(competenciaDe(inicio), 1))
  } else {
    consulta = consulta.eq('status', 'aberta').lt('vencimento', hoje)
  }
  const { data, error } = await consulta.order('vencimento').order('created_at')
  lancarSeErro(error, 'Falha ao listar cobranças')
  return ((data ?? []) as unknown as LinhaResumo[]).map(paraResumo)
}

export async function marcarPago(
  db: SupabaseClient,
  id: string,
  o: { pagoEm: DataISO; valorPagoCentavos?: number },
): Promise<void> {
  let valor = o.valorPagoCentavos
  if (valor === undefined) {
    const { data, error } = await db.from('cobrancas').select('valor_centavos').eq('id', id).maybeSingle()
    lancarSeErro(error, 'Falha ao ler cobrança')
    if (!data) throw new ErroNegocio('Cobrança não encontrada.')
    valor = Number(data.valor_centavos)
  }
  await chamarRpc(
    db,
    'marcar_pago',
    { p_cobranca_id: id, p_pago_em: o.pagoEm, p_valor_pago: valor },
    'Falha ao marcar cobrança como paga',
  )
}

export async function desfazerPagamento(db: SupabaseClient, id: string): Promise<void> {
  await chamarRpc(db, 'desfazer_pagamento', { p_cobranca_id: id }, 'Falha ao desfazer pagamento')
}

export async function editarCobranca(
  db: SupabaseClient,
  id: string,
  o: { vencimento?: DataISO; valorCentavos?: number },
): Promise<void> {
  if (o.valorCentavos !== undefined && (!Number.isInteger(o.valorCentavos) || o.valorCentavos < 0)) {
    throw new ErroNegocio('Valor inválido.')
  }
  const campos: Record<string, unknown> = {}
  if (o.vencimento !== undefined) campos.vencimento = o.vencimento
  if (o.valorCentavos !== undefined) campos.valor_centavos = o.valorCentavos
  if (Object.keys(campos).length === 0) return
  // O filtro de status torna a checagem atômica: pagas não são alteradas.
  const { data, error } = await db
    .from('cobrancas')
    .update(campos)
    .eq('id', id)
    .in('status', ['aberta', 'suspensa'])
    .select('id')
  lancarSeErro(error, 'Falha ao editar cobrança')
  if (!data || data.length === 0) {
    const { data: existe } = await db.from('cobrancas').select('id').eq('id', id).maybeSingle()
    throw new ErroNegocio(existe ? 'Só é possível editar cobranças não pagas.' : 'Cobrança não encontrada.')
  }
}
