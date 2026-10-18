'use server'

import { revalidatePath } from 'next/cache'
import type { DataISO } from '@/lib/dominio/datas'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarLeads } from '@/lib/servicos/leads'
import { criarTarefa, excluirTarefa } from '@/lib/servicos/tarefas'
import { ErroNegocio } from '@/lib/servicos/tipos'

export type RespostaAcao = { erro?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/

function dataValida(d: string): boolean {
  if (!DATA_ISO.test(d)) return false
  const x = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d
}

function revalidar(leadId?: string | null) {
  revalidatePath('/agenda')
  revalidatePath('/hoje')
  if (leadId) revalidatePath(`/leads/${leadId}`)
}

/** Cria tarefa avulsa (leadId nulo) ou ligada a um lead. */
export async function acaoCriarTarefaAgenda(
  titulo: string,
  data: DataISO,
  hora: string,
  leadId: string | null,
): Promise<RespostaAcao> {
  if (!titulo.trim()) return { erro: 'Informe o título da tarefa.' }
  if (!dataValida(data)) return { erro: 'Data inválida.' }
  if (hora && !HORA.test(hora)) return { erro: 'Hora inválida.' }
  if (leadId !== null && !UUID.test(leadId)) return { erro: 'Lead inválido.' }
  try {
    await criarTarefa(await criarClienteServidor(), { titulo, data, hora: hora || null, leadId })
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message }
    throw e
  }
  revalidar(leadId)
  return {}
}

export async function acaoExcluirTarefa(id: string): Promise<RespostaAcao> {
  if (!UUID.test(id)) return { erro: 'Tarefa inválida.' }
  await excluirTarefa(await criarClienteServidor(), id)
  revalidar()
  return {}
}

/** Busca leads por nome/empresa/telefone para o seletor do formulário (máx. 8). */
export async function acaoBuscarLeads(busca: string): Promise<{ id: string; nome: string; empresa: string | null }[]> {
  const termo = busca.trim()
  if (termo.length < 2) return []
  const leads = await listarLeads(await criarClienteServidor(), { busca: termo })
  return leads.slice(0, 8).map((l) => ({ id: l.id, nome: l.nome_contato, empresa: l.empresa }))
}
