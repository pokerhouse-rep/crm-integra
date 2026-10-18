'use server'

import { revalidatePath } from 'next/cache'
import type { DataISO } from '@/lib/dominio/datas'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarLeads } from '@/lib/servicos/leads'
import { criarTarefa, excluirTarefa } from '@/lib/servicos/tarefas'
import { ErroNegocio } from '@/lib/servicos/tipos'
import { dataValida, horaValida, uuidValido, type RespostaAcao } from '@/lib/validacao'

function revalidar() {
  revalidatePath('/agenda')
  revalidatePath('/hoje')
  revalidatePath('/leads', 'layout') // lista e detalhe do lead
  revalidatePath('/funil')
}

/** Cria tarefa avulsa (leadId nulo) ou ligada a um lead. */
export async function acaoCriarTarefa(
  titulo: string,
  data: DataISO,
  hora: string,
  leadId: string | null,
): Promise<RespostaAcao> {
  if (!titulo.trim()) return { erro: 'Informe o título da tarefa.' }
  if (!dataValida(data)) return { erro: 'Data inválida.' }
  if (hora && !horaValida(hora)) return { erro: 'Hora inválida.' }
  if (leadId !== null && !uuidValido(leadId)) return { erro: 'Lead inválido.' }
  try {
    await criarTarefa(await criarClienteServidor(), { titulo, data, hora: hora || null, leadId })
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message }
    throw e
  }
  revalidar()
  return {}
}

export async function acaoExcluirTarefa(id: string): Promise<RespostaAcao> {
  if (!uuidValido(id)) return { erro: 'Tarefa inválida.' }
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
