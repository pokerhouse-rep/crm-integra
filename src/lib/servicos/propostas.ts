import { agendarPrazo, type DataISO } from '@/lib/dominio/datas'
import { diaVencimentoPadrao, horizonteCobrancas, planejarCobrancasIniciais } from '@/lib/dominio/cobrancas'
import { dataEmPalmas } from '@/lib/dominio/periodo'
import { diasEntre } from '@/lib/dominio/relatorios'
import { totaisProposta, validarItem, valorLiquido, type ItemProposta } from '@/lib/dominio/propostas'
import { obterConfig } from './config'
import { chamarRpc } from './rpc'
import {
  ErroNegocio,
  lancarSeErro,
  type ItemPropostaRow,
  type Lead,
  type Proposta,
  type SupabaseClient,
  type VersaoProposta,
} from './tipos'

const MSG_MUDOU = 'A proposta mudou. Atualize a página e tente de novo.'

export interface PropostaDetalhe {
  proposta: Proposta
  lead: Lead
  versoes: (VersaoProposta & { itens: ItemProposta[] })[]
}

export type PropostaResumo = Proposta & {
  versaoAtual: number
  totalUnicoCentavos: number
  totalRecorrenteCentavos: number
}

export async function criarProposta(db: SupabaseClient, leadId: string, titulo?: string): Promise<string> {
  return chamarRpc<string>(db, 'criar_proposta', { p_lead_id: leadId, p_titulo: titulo ?? null }, 'Falha ao criar proposta')
}

function normalizarItem(item: ItemProposta): ItemProposta {
  return {
    ...item,
    descricao: item.descricao.trim(),
    parcelas: item.tipo === 'unico' ? item.parcelas : 1,
    mesInicio: item.tipo === 'recorrente' ? item.mesInicio : null,
  }
}

export async function salvarItens(db: SupabaseClient, propostaId: string, itens: ItemProposta[]): Promise<void> {
  const normalizados = itens.map(normalizarItem)
  normalizados.forEach((item, i) => {
    const n = i + 1
    if (item.desconto && !Number.isInteger(item.desconto.valor)) throw new ErroNegocio(`Item ${n}: Desconto inválido.`)
    const erro = validarItem(item)
    if (erro) throw new ErroNegocio(`Item ${n}: ${erro}`)
    if (item.tipo === 'unico' && valorLiquido(item) < item.parcelas) {
      throw new ErroNegocio(`Item ${n}: O valor é baixo demais para esse número de parcelas.`)
    }
  })
  const totais = totaisProposta(normalizados)
  await chamarRpc(
    db,
    'salvar_itens_versao',
    {
      p_proposta_id: propostaId,
      p_itens: normalizados.map((i) => ({
        servico_id: i.servicoId,
        descricao: i.descricao,
        tipo: i.tipo,
        valor_centavos: i.valorCentavos,
        parcelas: i.parcelas,
        mes_inicio: i.mesInicio,
        desconto_tipo: i.desconto?.tipo ?? null,
        desconto_valor: i.desconto?.valor ?? null,
      })),
      p_total_unico: totais.unicoCentavos,
      p_total_recorrente: totais.recorrenteCentavos,
    },
    'Falha ao salvar itens da proposta',
  )
}

export async function novaVersao(db: SupabaseClient, propostaId: string): Promise<number> {
  return chamarRpc<number>(db, 'nova_versao', { p_proposta_id: propostaId }, 'Falha ao criar nova versão')
}

export async function enviarProposta(db: SupabaseClient, propostaId: string, hoje: DataISO): Promise<void> {
  const config = await obterConfig(db)
  await chamarRpc(
    db,
    'enviar_proposta',
    { p_proposta_id: propostaId, p_data_retorno: agendarPrazo(hoje, config.diasRetornoProposta) },
    'Falha ao enviar proposta',
  )
}

export async function recusarProposta(db: SupabaseClient, propostaId: string): Promise<void> {
  await chamarRpc(db, 'recusar_proposta', { p_proposta_id: propostaId }, 'Falha ao recusar proposta')
}

export async function aceitarProposta(
  db: SupabaseClient,
  propostaId: string,
  o: {
    hoje: DataISO
    diaVencimento?: number
    primeiroVencimento?: DataISO
    descricao?: string
    /** Versão e totais que a tela mostrou; se divergirem do banco, o aceite é recusado. */
    versaoEsperada?: string
    totaisEsperados?: { itens: number; unicoCentavos: number; recorrenteCentavos: number }
  },
): Promise<string> {
  const dia = o.diaVencimento ?? diaVencimentoPadrao(o.hoje)
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
    throw new ErroNegocio('O dia de vencimento deve ser entre 1 e 28.')
  }
  const { proposta, versoes } = await obterProposta(db, propostaId)
  const versao = versoes[0]
  if (!versao || versao.itens.length === 0) throw new ErroNegocio('A proposta não tem itens.')
  if (o.versaoEsperada !== undefined && o.versaoEsperada !== versao.id) throw new ErroNegocio(MSG_MUDOU)
  if (o.totaisEsperados) {
    const t = totaisProposta(versao.itens)
    if (
      o.totaisEsperados.itens !== versao.itens.length ||
      o.totaisEsperados.unicoCentavos !== t.unicoCentavos ||
      o.totaisEsperados.recorrenteCentavos !== t.recorrenteCentavos
    ) {
      throw new ErroNegocio(MSG_MUDOU)
    }
  }

  const itens = versao.itens.map((i) => ({
    descricao: i.descricao,
    tipo: i.tipo,
    valorCentavos: valorLiquido(i),
    parcelas: i.parcelas,
    mesInicio: i.mesInicio,
  }))
  const cobrancas = planejarCobrancasIniciais(itens, {
    diaVencimento: dia,
    primeiroVencimento: o.primeiroVencimento ?? o.hoje,
    ate: horizonteCobrancas(o.hoje),
  })

  return chamarRpc<string>(
    db,
    'aceitar_proposta',
    {
      p_proposta_id: propostaId,
      p_versao_id: versao.id,
      p_descricao: o.descricao?.trim() || proposta.titulo,
      p_dia_vencimento: dia,
      p_data_inicio: o.hoje,
      p_itens: itens.map((i) => ({
        descricao: i.descricao,
        tipo: i.tipo,
        valor_centavos: i.valorCentavos,
        parcelas: i.parcelas,
        mes_inicio: i.mesInicio,
      })),
      p_cobrancas: cobrancas.map((c) => ({
        item_indice: c.itemIndice,
        tipo: c.tipo,
        numero: c.numero,
        total_parcelas: c.totalParcelas,
        competencia: c.competencia,
        vencimento: c.vencimento,
        valor_centavos: c.valorCentavos,
      })),
    },
    'Falha ao aceitar proposta',
  )
}

function paraItemDominio(r: ItemPropostaRow): ItemProposta {
  return {
    servicoId: r.servico_id,
    descricao: r.descricao,
    tipo: r.tipo,
    valorCentavos: Number(r.valor_centavos),
    parcelas: r.parcelas,
    mesInicio: r.mes_inicio,
    desconto:
      r.desconto_tipo && r.desconto_valor !== null ? { tipo: r.desconto_tipo, valor: Number(r.desconto_valor) } : null,
  }
}

export async function obterProposta(db: SupabaseClient, id: string): Promise<PropostaDetalhe> {
  const { data: proposta, error } = await db.from('propostas').select('*').eq('id', id).maybeSingle()
  lancarSeErro(error, 'Falha ao ler proposta')
  if (!proposta) throw new ErroNegocio('Proposta não encontrada.')

  const { data: lead, error: e2 } = await db.from('leads').select('*').eq('id', proposta.lead_id).maybeSingle()
  lancarSeErro(e2, 'Falha ao ler lead')
  if (!lead) throw new ErroNegocio('Lead não encontrado.')

  const { data: versoes, error: e3 } = await db
    .from('versoes_proposta')
    .select('*')
    .eq('proposta_id', id)
    .order('numero', { ascending: false })
  lancarSeErro(e3, 'Falha ao ler versões')

  const ids = (versoes ?? []).map((v) => v.id as string)
  const { data: itens, error: e4 } = ids.length
    ? await db.from('itens_proposta').select('*').in('versao_id', ids).order('ordem')
    : { data: [], error: null }
  lancarSeErro(e4, 'Falha ao ler itens')

  return {
    proposta: proposta as Proposta,
    lead: lead as Lead,
    versoes: ((versoes ?? []) as VersaoProposta[]).map((v) => ({
      ...v,
      total_unico_centavos: Number(v.total_unico_centavos),
      total_recorrente_centavos: Number(v.total_recorrente_centavos),
      itens: ((itens ?? []) as ItemPropostaRow[]).filter((i) => i.versao_id === v.id).map(paraItemDominio),
    })),
  }
}

export async function listarPropostasDoLead(db: SupabaseClient, leadId: string): Promise<PropostaResumo[]> {
  const { data, error } = await db
    .from('propostas')
    .select('*, versoes_proposta(numero, total_unico_centavos, total_recorrente_centavos)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .order('id')
  lancarSeErro(error, 'Falha ao listar propostas')
  return (data ?? []).map((p) => {
    const { versoes_proposta: versoes, ...proposta } = p as Proposta & {
      versoes_proposta: { numero: number; total_unico_centavos: number; total_recorrente_centavos: number }[]
    }
    const ultima = [...versoes].sort((a, b) => b.numero - a.numero)[0]
    return {
      ...proposta,
      versaoAtual: ultima?.numero ?? 1,
      totalUnicoCentavos: Number(ultima?.total_unico_centavos ?? 0),
      totalRecorrenteCentavos: Number(ultima?.total_recorrente_centavos ?? 0),
    }
  })
}

/** P12: soma da última versão das propostas em rascunho ou enviadas, por lead; leads perdidos não somam. */
export async function valoresAbertosPorLead(
  db: SupabaseClient,
): Promise<Record<string, { unicoCentavos: number; recorrenteCentavos: number }>> {
  const { data, error } = await db
    .from('propostas')
    .select(
      'lead_id, leads!inner(etapa), versoes_proposta(numero, total_unico_centavos, total_recorrente_centavos)',
    )
    .in('status', ['rascunho', 'enviada'])
    .neq('leads.etapa', 'perdido')
  lancarSeErro(error, 'Falha ao ler valores em negociação')
  const saida: Record<string, { unicoCentavos: number; recorrenteCentavos: number }> = {}
  for (const p of (data ?? []) as unknown as {
    lead_id: string
    versoes_proposta: { numero: number; total_unico_centavos: number; total_recorrente_centavos: number }[]
  }[]) {
    const ultima = [...p.versoes_proposta].sort((a, b) => b.numero - a.numero)[0]
    if (!ultima) continue
    const atual = (saida[p.lead_id] ??= { unicoCentavos: 0, recorrenteCentavos: 0 })
    atual.unicoCentavos += Number(ultima.total_unico_centavos)
    atual.recorrenteCentavos += Number(ultima.total_recorrente_centavos)
  }
  return saida
}

export interface PropostaAguardando {
  id: string
  leadId: string
  nomeLead: string
  empresa: string | null
  titulo: string
  versao: number
  unicoCentavos: number
  recorrenteCentavos: number
  enviadaEm: DataISO
  dias: number
}

/** D12: propostas enviadas (última versão enviada de cada), da mais antiga para a mais recente. */
export async function propostasAguardando(db: SupabaseClient, hoje: DataISO): Promise<PropostaAguardando[]> {
  const { data, error } = await db
    .from('propostas')
    .select(
      'id, lead_id, titulo, leads!inner(nome_contato, empresa), versoes_proposta(numero, total_unico_centavos, total_recorrente_centavos, enviada_em)',
    )
    .eq('status', 'enviada')
  lancarSeErro(error, 'Falha ao ler propostas aguardando resposta')
  const saida: PropostaAguardando[] = []
  for (const p of (data ?? []) as unknown as {
    id: string
    lead_id: string
    titulo: string
    leads: { nome_contato: string; empresa: string | null }
    versoes_proposta: {
      numero: number
      total_unico_centavos: number
      total_recorrente_centavos: number
      enviada_em: string | null
    }[]
  }[]) {
    const enviadas = p.versoes_proposta.filter((v) => v.enviada_em !== null)
    const ultima = enviadas.sort((a, b) => b.numero - a.numero)[0]
    if (!ultima?.enviada_em) continue
    const enviadaEm = dataEmPalmas(ultima.enviada_em)
    saida.push({
      id: p.id,
      leadId: p.lead_id,
      nomeLead: p.leads.nome_contato,
      empresa: p.leads.empresa,
      titulo: p.titulo,
      versao: ultima.numero,
      unicoCentavos: Number(ultima.total_unico_centavos),
      recorrenteCentavos: Number(ultima.total_recorrente_centavos),
      enviadaEm,
      dias: diasEntre(enviadaEm, hoje),
    })
  }
  return saida.sort((a, b) => a.enviadaEm.localeCompare(b.enviadaEm) || a.id.localeCompare(b.id))
}
