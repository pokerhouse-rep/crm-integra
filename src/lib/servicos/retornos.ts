import type { DataISO } from '@/lib/dominio/datas'
import { gerarDatasSequencia, planejarResultado, type PlanoResultado } from '@/lib/dominio/sequencia'
import type { Etapa, OrigemRetorno, Resultado } from '@/lib/dominio/tipos'
import { obterConfig } from './config'
import { registrarEvento } from './leads'
import { ErroNegocio, lancarSeErro, type Lead, type Retorno, type SupabaseClient } from './tipos'

const MSG_MOTIVO = 'Informe o motivo da perda.'

async function buscarLead(db: SupabaseClient, id: string): Promise<Lead> {
  const { data, error } = await db.from('leads').select('*').eq('id', id).maybeSingle()
  lancarSeErro(error, 'Falha ao ler lead')
  if (!data) throw new ErroNegocio('Lead não encontrado.')
  return data as Lead
}

async function atualizarLeadRow(db: SupabaseClient, id: string, campos: Record<string, unknown>): Promise<void> {
  const { error } = await db
    .from('leads')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', id)
  lancarSeErro(error, 'Falha ao atualizar lead')
}

async function cancelarPendentes(db: SupabaseClient, leadId: string): Promise<void> {
  const { error } = await db
    .from('retornos')
    .update({ status: 'cancelado' })
    .eq('lead_id', leadId)
    .eq('status', 'pendente')
  lancarSeErro(error, 'Falha ao cancelar retornos')
}

async function contarPendentes(db: SupabaseClient, leadId: string): Promise<number> {
  const { count, error } = await db
    .from('retornos')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('status', 'pendente')
  lancarSeErro(error, 'Falha ao contar retornos')
  return count ?? 0
}

async function criarRetornos(
  db: SupabaseClient,
  leadId: string,
  itens: { data: DataISO; origem: OrigemRetorno; ciclo: number }[],
): Promise<void> {
  if (itens.length === 0) return
  const { error } = await db
    .from('retornos')
    .insert(itens.map((i) => ({ lead_id: leadId, data_prevista: i.data, origem: i.origem, ciclo: i.ciclo })))
  lancarSeErro(error, 'Falha ao criar retornos')
}

async function buscarRetorno(db: SupabaseClient, id: string): Promise<Retorno> {
  const { data, error } = await db.from('retornos').select('*').eq('id', id).maybeSingle()
  lancarSeErro(error, 'Falha ao ler retorno')
  if (!data) throw new ErroNegocio('Retorno não encontrado.')
  return data as Retorno
}

export async function marcarMvpEnviado(
  db: SupabaseClient,
  leadId: string,
  opcoes: { link?: string; hoje: DataISO },
): Promise<void> {
  await buscarLead(db, leadId)
  if ((await contarPendentes(db, leadId)) > 0) throw new ErroNegocio('Este lead já tem retornos pendentes.')
  const config = await obterConfig(db)
  const campos: Record<string, unknown> = { mvp_enviado_em: opcoes.hoje, etapa: 'mvp_enviado' }
  if (opcoes.link !== undefined) campos.link_mvp = opcoes.link
  await atualizarLeadRow(db, leadId, campos)
  await criarRetornos(
    db,
    leadId,
    gerarDatasSequencia(opcoes.hoje, config.sequenciaPadrao).map((data) => ({
      data,
      origem: 'sequencia' as const,
      ciclo: 1,
    })),
  )
  await registrarEvento(db, leadId, 'mvp_enviado', { link: opcoes.link ?? null })
}

export async function registrarResultado(
  db: SupabaseClient,
  retornoId: string,
  entrada: { resultado: Resultado; novaData?: DataISO; motivoPerdaId?: string; hoje: DataISO },
): Promise<PlanoResultado> {
  const jaRegistrado = () => new ErroNegocio('Este retorno já foi registrado.')
  const retorno = await buscarRetorno(db, retornoId)
  if (retorno.status !== 'pendente') throw jaRegistrado()
  if (entrada.resultado === 'sem_interesse' && !entrada.motivoPerdaId) throw new ErroNegocio(MSG_MOTIVO)
  if (entrada.resultado === 'pediu_tempo' && !entrada.novaData) throw new ErroNegocio('Informe a nova data do retorno.')

  const lead = await buscarLead(db, retorno.lead_id)
  const config = await obterConfig(db)

  // Transição atômica pendente -> feito: protege contra toque duplo / requisições concorrentes.
  const { data: marcado, error } = await db
    .from('retornos')
    .update({ status: 'feito', resultado: entrada.resultado, feito_em: new Date().toISOString() })
    .eq('id', retornoId)
    .eq('status', 'pendente')
    .select('id')
  lancarSeErro(error, 'Falha ao registrar retorno')
  if (!marcado || marcado.length === 0) throw jaRegistrado()

  const plano = planejarResultado({
    resultado: entrada.resultado,
    hoje: entrada.hoje,
    novaData: entrada.novaData,
    pendentesRestantes: await contarPendentes(db, lead.id),
    offsetsPadrao: config.sequenciaPadrao,
    diasReativacao: config.diasReativacao,
  })

  if (plano.cancelarPendentes) await cancelarPendentes(db, lead.id)

  // Resposta só avança prospect/MVP enviado; etapas mais adiantadas não regridem.
  let novaEtapa = plano.novaEtapa
  if (entrada.resultado === 'respondeu' && lead.etapa !== 'prospect' && lead.etapa !== 'mvp_enviado') novaEtapa = null

  await criarRetornos(
    db,
    lead.id,
    plano.novosRetornos.map((n) => ({
      data: n.data,
      origem: n.origem,
      ciclo: n.origem === 'reativacao' ? retorno.ciclo + 1 : retorno.ciclo,
    })),
  )

  const campos: Record<string, unknown> = {}
  if (novaEtapa && novaEtapa !== lead.etapa) campos.etapa = novaEtapa
  if (plano.frio === 'marcar') campos.frio = true
  if (plano.frio === 'limpar' && lead.frio) campos.frio = false
  if (entrada.resultado === 'sem_interesse') campos.motivo_perda_id = entrada.motivoPerdaId
  if (Object.keys(campos).length > 0) await atualizarLeadRow(db, lead.id, campos)

  await registrarEvento(db, lead.id, 'retorno_feito', {
    resultado: entrada.resultado,
    retorno_id: retornoId,
    ciclo: retorno.ciclo,
    ...(entrada.novaData ? { nova_data: entrada.novaData } : {}),
  })
  if (campos.etapa) await registrarEvento(db, lead.id, 'etapa_alterada', { de: lead.etapa, para: campos.etapa })
  if (plano.frio === 'marcar') await registrarEvento(db, lead.id, 'frio', { ciclo: retorno.ciclo + 1 })
  if (plano.frio === 'limpar' && lead.frio) await registrarEvento(db, lead.id, 'reativado')
  return plano
}

export async function moverEtapa(
  db: SupabaseClient,
  leadId: string,
  etapa: Etapa,
  motivoPerdaId?: string,
): Promise<void> {
  if (etapa === 'perdido' && !motivoPerdaId) throw new ErroNegocio(MSG_MOTIVO)
  const lead = await buscarLead(db, leadId)
  const campos: Record<string, unknown> = { etapa }
  if (etapa === 'perdido') campos.motivo_perda_id = motivoPerdaId
  if (etapa === 'fechado') campos.cliente = true
  if (etapa === 'perdido' || etapa === 'fechado') await cancelarPendentes(db, leadId)
  await atualizarLeadRow(db, leadId, campos)
  await registrarEvento(db, leadId, 'etapa_alterada', { de: lead.etapa, para: etapa })
}

async function cicloAtual(db: SupabaseClient, leadId: string): Promise<number> {
  const { data, error } = await db
    .from('retornos')
    .select('ciclo')
    .eq('lead_id', leadId)
    .order('ciclo', { ascending: false })
    .limit(1)
    .maybeSingle()
  lancarSeErro(error, 'Falha ao ler ciclo')
  return data?.ciclo ?? 1
}

export async function adicionarRetorno(db: SupabaseClient, leadId: string, data: DataISO): Promise<void> {
  await buscarLead(db, leadId)
  await criarRetornos(db, leadId, [{ data, origem: 'manual', ciclo: await cicloAtual(db, leadId) }])
}

export async function alterarDataRetorno(db: SupabaseClient, retornoId: string, data: DataISO): Promise<void> {
  const { data: atualizado, error } = await db
    .from('retornos')
    .update({ data_prevista: data })
    .eq('id', retornoId)
    .eq('status', 'pendente')
    .select('id')
  lancarSeErro(error, 'Falha ao alterar data')
  if (!atualizado || atualizado.length === 0) throw new ErroNegocio('Só é possível alterar retornos pendentes.')
}

export async function cancelarRetorno(db: SupabaseClient, retornoId: string): Promise<void> {
  const { data, error } = await db
    .from('retornos')
    .update({ status: 'cancelado' })
    .eq('id', retornoId)
    .eq('status', 'pendente')
    .select('id')
  lancarSeErro(error, 'Falha ao cancelar retorno')
  if (!data || data.length === 0) throw new ErroNegocio('Só é possível cancelar retornos pendentes.')
}

export async function aplicarSequencia(
  db: SupabaseClient,
  leadId: string,
  offsets: number[],
  base: DataISO,
): Promise<void> {
  const lead = await buscarLead(db, leadId)
  const ciclo = await cicloAtual(db, leadId)
  await cancelarPendentes(db, leadId)
  await criarRetornos(
    db,
    leadId,
    gerarDatasSequencia(base, offsets).map((data) => ({ data, origem: 'sequencia' as const, ciclo })),
  )
  // Sequência ativa significa que o lead não está mais frio.
  if (lead.frio) await atualizarLeadRow(db, leadId, { frio: false })
}
