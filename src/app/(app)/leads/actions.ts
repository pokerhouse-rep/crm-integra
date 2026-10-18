'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hojeEmPalmas, type DataISO } from '@/lib/dominio/datas'
import { ETAPAS, type Etapa } from '@/lib/dominio/tipos'
import { criarClienteServidor } from '@/lib/supabase/server'
import { adicionarAnotacao, atualizarLead, criarLead, obterLeadPorWhatsapp } from '@/lib/servicos/leads'
import {
  adicionarRetorno,
  alterarDataRetorno,
  aplicarSequencia,
  cancelarRetorno,
  marcarMvpEnviado,
  moverEtapa,
} from '@/lib/servicos/retornos'
import { concluirTarefa } from '@/lib/servicos/tarefas'
import { dataValida, erroSequencia, uuidValido, type RespostaAcao } from '@/lib/validacao'
import { ErroNegocio, type DadosLead, type SupabaseClient } from '@/lib/servicos/tipos'

export type { RespostaAcao }

export interface ValoresLead {
  nomeContato: string
  whatsapp: string
  empresa: string
  email: string
  cidade: string
  nichoId: string
  origemId: string
  linkMvp: string
  observacoes: string
}

export type CampoLead = keyof ValoresLead

export interface RespostaSalvarLead {
  erro?: string
  campo?: CampoLead
  /** Lead que já usa o WhatsApp informado (para linkar no aviso de duplicado). */
  leadExistenteId?: string
}

function linkValido(l: string): boolean {
  try {
    const u = new URL(l)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function vazioParaNulo(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}

function revalidarLead(leadId?: string) {
  revalidatePath('/leads')
  revalidatePath('/hoje')
  revalidatePath('/agenda')
  revalidatePath('/funil')
  if (leadId) revalidatePath(`/leads/${leadId}`)
}

async function executar(leadId: string, fn: (db: SupabaseClient) => Promise<void>): Promise<RespostaAcao> {
  if (!uuidValido(leadId)) return { erro: 'Lead inválido.' }
  try {
    await fn(await criarClienteServidor())
  } catch (e) {
    if (e instanceof ErroNegocio) {
      revalidarLead(leadId) // o estado pode ter mudado (ex.: toque duplo)
      return { erro: e.message }
    }
    throw e
  }
  revalidarLead(leadId)
  return {}
}

function campoDoErro(mensagem: string): CampoLead | undefined {
  if (/whatsapp/i.test(mensagem)) return 'whatsapp'
  return undefined
}

/** Cria (leadId ausente) ou atualiza o lead; em caso de sucesso vai para o detalhe. */
export async function acaoSalvarLead(leadId: string | null, v: ValoresLead): Promise<RespostaSalvarLead> {
  if (leadId !== null && !uuidValido(leadId)) return { erro: 'Lead inválido.' }
  const nomeContato = v.nomeContato.trim()
  if (!nomeContato) return { erro: 'Informe o nome do contato.', campo: 'nomeContato' }
  if (!v.whatsapp.trim()) return { erro: 'Informe o WhatsApp.', campo: 'whatsapp' }
  const email = vazioParaNulo(v.email)
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { erro: 'E-mail inválido.', campo: 'email' }
  const linkMvp = vazioParaNulo(v.linkMvp)
  if (linkMvp && !linkValido(linkMvp)) {
    return { erro: 'Link inválido. Use um endereço começando com http:// ou https://.', campo: 'linkMvp' }
  }
  const nichoId = vazioParaNulo(v.nichoId)
  const origemId = vazioParaNulo(v.origemId)
  if ((nichoId && !uuidValido(nichoId)) || (origemId && !uuidValido(origemId))) return { erro: 'Opção inválida.' }

  const dados: DadosLead = {
    nomeContato,
    whatsapp: v.whatsapp,
    empresa: vazioParaNulo(v.empresa),
    email,
    cidade: vazioParaNulo(v.cidade),
    nichoId,
    origemId,
    linkMvp,
    observacoes: vazioParaNulo(v.observacoes),
  }

  const db = await criarClienteServidor()
  let id: string
  try {
    if (leadId) {
      id = (await atualizarLead(db, leadId, dados)).id
    } else {
      id = (await criarLead(db, dados)).id
    }
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e
    const duplicado = e.message.startsWith('Já existe um lead')
    let existente: string | undefined
    if (duplicado) {
      const l = await obterLeadPorWhatsapp(db, v.whatsapp)
      if (l && l.id !== leadId) existente = l.id
    }
    return { erro: e.message, campo: campoDoErro(e.message), leadExistenteId: existente }
  }
  revalidarLead(id)
  redirect(`/leads/${id}`)
}

export async function acaoMoverEtapa(leadId: string, etapa: Etapa, motivoPerdaId?: string): Promise<RespostaAcao> {
  if (!ETAPAS.some((e) => e.valor === etapa)) return { erro: 'Etapa inválida.' }
  if (motivoPerdaId !== undefined && !uuidValido(motivoPerdaId)) return { erro: 'Motivo inválido.' }
  return executar(leadId, (db) => moverEtapa(db, leadId, etapa, motivoPerdaId))
}

export async function acaoMarcarMvpEnviado(leadId: string, link: string): Promise<RespostaAcao> {
  const l = link.trim()
  if (l && !linkValido(l)) return { erro: 'Link inválido. Use um endereço começando com http:// ou https://.' }
  return executar(leadId, (db) => marcarMvpEnviado(db, leadId, { link: l || undefined, hoje: hojeEmPalmas() }))
}

export async function acaoAlterarDataRetorno(leadId: string, retornoId: string, data: DataISO): Promise<RespostaAcao> {
  if (!uuidValido(retornoId)) return { erro: 'Retorno inválido.' }
  if (!dataValida(data)) return { erro: 'Data inválida.' }
  return executar(leadId, (db) => alterarDataRetorno(db, retornoId, data))
}

export async function acaoCancelarRetorno(leadId: string, retornoId: string): Promise<RespostaAcao> {
  if (!uuidValido(retornoId)) return { erro: 'Retorno inválido.' }
  return executar(leadId, (db) => cancelarRetorno(db, retornoId))
}

export async function acaoAdicionarRetorno(leadId: string, data: DataISO): Promise<RespostaAcao> {
  if (!dataValida(data)) return { erro: 'Data inválida.' }
  return executar(leadId, (db) => adicionarRetorno(db, leadId, data))
}

/** Troca os retornos pendentes por uma nova sequência (ex.: "3, 7, 15"), contada a partir de hoje. */
export async function acaoTrocarSequencia(leadId: string, texto: string): Promise<RespostaAcao> {
  const partes = texto.split(/[\s,;]+/).filter(Boolean)
  const offsets = partes.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  if (offsets.length === 0 || offsets.some((o) => !Number.isInteger(o) || o < 1)) {
    return { erro: 'Informe os dias separados por vírgula, por exemplo: 3, 7, 15.' }
  }
  if (offsets.length > 10) return { erro: 'Use no máximo 10 retornos.' }
  const erro = erroSequencia(offsets)
  if (erro) return { erro }
  return executar(leadId, (db) => aplicarSequencia(db, leadId, offsets, hojeEmPalmas()))
}

export async function acaoAdicionarAnotacao(leadId: string, texto: string): Promise<RespostaAcao> {
  if (!uuidValido(leadId)) return { erro: 'Lead inválido.' }
  const t = texto.trim()
  if (!t) return { erro: 'Escreva a anotação.' }
  return executar(leadId, (db) => adicionarAnotacao(db, leadId, t))
}

export async function acaoConcluirTarefaDoLead(leadId: string, tarefaId: string): Promise<RespostaAcao> {
  if (!uuidValido(tarefaId)) return { erro: 'Tarefa inválida.' }
  return executar(leadId, (db) => concluirTarefa(db, tarefaId))
}
