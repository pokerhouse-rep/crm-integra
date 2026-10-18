import { normalizarTelefone } from '@/lib/dominio/telefone'
import type { Etapa } from '@/lib/dominio/tipos'
import {
  ErroNegocio,
  lancarSeErro,
  type DadosLead,
  type Evento,
  type Lead,
  type LeadDetalhe,
  type LeadResumo,
  type Retorno,
  type SupabaseClient,
} from './tipos'

export async function registrarEvento(
  db: SupabaseClient,
  leadId: string,
  tipo: string,
  dados: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await db.from('eventos').insert({ lead_id: leadId, tipo, dados })
  lancarSeErro(error, 'Falha ao registrar evento')
}

function colunas(dados: Partial<DadosLead>): Record<string, unknown> {
  const mapa: Record<string, unknown> = {
    nome_contato: dados.nomeContato,
    empresa: dados.empresa,
    email: dados.email,
    cidade: dados.cidade,
    nicho_id: dados.nichoId,
    origem_id: dados.origemId,
    link_mvp: dados.linkMvp,
    observacoes: dados.observacoes,
  }
  return Object.fromEntries(Object.entries(mapa).filter(([, v]) => v !== undefined))
}

function whatsappNormalizado(entrada: string): string {
  const n = normalizarTelefone(entrada)
  if (!n) throw new ErroNegocio('WhatsApp inválido. Use DDD + número.')
  return n
}

async function lancarDuplicado(db: SupabaseClient, whatsapp: string): Promise<never> {
  const { data } = await db.from('leads').select('nome_contato').eq('whatsapp', whatsapp).maybeSingle()
  throw new ErroNegocio(`Já existe um lead com este WhatsApp: ${data?.nome_contato ?? whatsapp}`)
}

export async function criarLead(db: SupabaseClient, dados: DadosLead): Promise<Lead> {
  const whatsapp = whatsappNormalizado(dados.whatsapp)
  const { data: existente, error: e1 } = await db
    .from('leads')
    .select('nome_contato')
    .eq('whatsapp', whatsapp)
    .maybeSingle()
  lancarSeErro(e1, 'Falha ao verificar duplicidade')
  if (existente) throw new ErroNegocio(`Já existe um lead com este WhatsApp: ${existente.nome_contato}`)

  const { data, error } = await db
    .from('leads')
    .insert({ ...colunas(dados), whatsapp })
    .select()
    .single()
  if (error?.code === '23505') await lancarDuplicado(db, whatsapp)
  lancarSeErro(error, 'Falha ao criar lead')
  await registrarEvento(db, data!.id, 'criado')
  return data as Lead
}

export async function atualizarLead(db: SupabaseClient, id: string, dados: Partial<DadosLead>): Promise<Lead> {
  const campos: Record<string, unknown> = colunas(dados)
  if (dados.whatsapp !== undefined) campos.whatsapp = whatsappNormalizado(dados.whatsapp)
  const { data, error } = await db
    .from('leads')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error?.code === '23505') await lancarDuplicado(db, campos.whatsapp as string)
  lancarSeErro(error, 'Falha ao atualizar lead')
  if (!data) throw new ErroNegocio('Lead não encontrado.')
  await registrarEvento(db, id, 'dados_editados', { campos: Object.keys(campos) })
  return data as Lead
}

export async function adicionarAnotacao(db: SupabaseClient, leadId: string, texto: string): Promise<void> {
  await registrarEvento(db, leadId, 'anotacao', { texto })
}

export interface FiltrosLeads {
  etapa?: Etapa
  nichoId?: string
  origemId?: string
  frio?: boolean
  busca?: string
}

export async function listarLeads(db: SupabaseClient, filtros: FiltrosLeads): Promise<LeadResumo[]> {
  let q = db.from('leads').select('*').order('updated_at', { ascending: false })
  if (filtros.etapa) q = q.eq('etapa', filtros.etapa)
  if (filtros.nichoId) q = q.eq('nicho_id', filtros.nichoId)
  if (filtros.origemId) q = q.eq('origem_id', filtros.origemId)
  if (filtros.frio !== undefined) q = q.eq('frio', filtros.frio)
  const busca = filtros.busca?.trim()
  if (busca) {
    // remove caracteres que quebram a sintaxe do filtro .or() e curingas do LIKE
    const texto = busca.replace(/[,()%_*\\]/g, ' ').trim()
    const digitos = busca.replace(/\D/g, '')
    const partes: string[] = []
    if (texto) partes.push(`nome_contato.ilike.%${texto}%`, `empresa.ilike.%${texto}%`)
    if (digitos) partes.push(`whatsapp.like.%${digitos}%`)
    if (partes.length === 0) return []
    q = q.or(partes.join(','))
  }
  const { data, error } = await q
  lancarSeErro(error, 'Falha ao listar leads')
  const leads = (data ?? []) as Lead[]
  if (leads.length === 0) return []

  // Uma única consulta traz todos os retornos pendentes (ordenados por data); o primeiro de cada lead é o próximo.
  const { data: pendentes, error: e2 } = await db
    .from('retornos')
    .select('lead_id, data_prevista')
    .eq('status', 'pendente')
    .order('data_prevista')
  lancarSeErro(e2, 'Falha ao ler próximos retornos')
  const proximo = new Map<string, string>()
  for (const r of (pendentes ?? []) as { lead_id: string; data_prevista: string }[]) {
    if (!proximo.has(r.lead_id)) proximo.set(r.lead_id, r.data_prevista)
  }
  return leads.map((l) => ({ ...l, proximo_retorno: proximo.get(l.id) ?? null }))
}

/** Lead com este WhatsApp (aceita qualquer formato), ou null. */
export async function obterLeadPorWhatsapp(db: SupabaseClient, whatsapp: string): Promise<Lead | null> {
  const n = normalizarTelefone(whatsapp)
  if (!n) return null
  const { data, error } = await db.from('leads').select('*').eq('whatsapp', n).maybeSingle()
  lancarSeErro(error, 'Falha ao buscar lead')
  return (data as Lead | null) ?? null
}

export async function obterLead(db: SupabaseClient, id: string): Promise<LeadDetalhe> {
  const [lead, retornos, eventos] = await Promise.all([
    db.from('leads').select('*').eq('id', id).maybeSingle(),
    db.from('retornos').select('*').eq('lead_id', id),
    db.from('eventos').select('*').eq('lead_id', id).order('ocorrido_em', { ascending: false }),
  ])
  lancarSeErro(lead.error, 'Falha ao ler lead')
  lancarSeErro(retornos.error, 'Falha ao ler retornos')
  lancarSeErro(eventos.error, 'Falha ao ler eventos')
  if (!lead.data) throw new ErroNegocio('Lead não encontrado.')
  const ordem = { pendente: 0, feito: 1, cancelado: 2 } as const
  const ordenados = [...(retornos.data as Retorno[])].sort(
    (a, b) => ordem[a.status] - ordem[b.status] || a.data_prevista.localeCompare(b.data_prevista),
  )
  return { lead: lead.data as Lead, retornos: ordenados, eventos: eventos.data as Evento[] }
}
