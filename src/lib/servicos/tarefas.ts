import type { DataISO } from '@/lib/dominio/datas'
import { registrarEvento } from './leads'
import { ErroNegocio, lancarSeErro, type SupabaseClient, type Tarefa } from './tipos'

export interface DadosTarefa {
  titulo: string
  data: DataISO
  hora?: string | null
  leadId?: string | null
}

export async function criarTarefa(db: SupabaseClient, dados: DadosTarefa): Promise<Tarefa> {
  const titulo = dados.titulo.trim()
  if (!titulo) throw new ErroNegocio('Informe o título da tarefa.')
  const { data, error } = await db
    .from('tarefas')
    .insert({ titulo, data: dados.data, hora: dados.hora ?? null, lead_id: dados.leadId ?? null })
    .select()
    .single()
  lancarSeErro(error, 'Falha ao criar tarefa')
  return data as Tarefa
}

/** Conclui a tarefa; com lead vinculado registra o evento tarefa_concluida (só na primeira conclusão). */
export async function concluirTarefa(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db
    .from('tarefas')
    .update({ feita: true, feita_em: new Date().toISOString() })
    .eq('id', id)
    .eq('feita', false)
    .select()
  lancarSeErro(error, 'Falha ao concluir tarefa')
  const tarefa = (data as Tarefa[] | null)?.[0]
  if (!tarefa) {
    const { data: existente, error: e2 } = await db.from('tarefas').select('id').eq('id', id).maybeSingle()
    lancarSeErro(e2, 'Falha ao ler tarefa')
    if (!existente) throw new ErroNegocio('Tarefa não encontrada.')
    return // já estava concluída
  }
  if (tarefa.lead_id) await registrarEvento(db, tarefa.lead_id, 'tarefa_concluida', { titulo: tarefa.titulo })
}

export async function reagendarTarefa(
  db: SupabaseClient,
  id: string,
  data: DataISO,
  hora?: string | null,
): Promise<void> {
  const { data: linhas, error } = await db
    .from('tarefas')
    .update({ data, hora: hora ?? null })
    .eq('id', id)
    .select('id')
  lancarSeErro(error, 'Falha ao reagendar tarefa')
  if (!linhas?.length) throw new ErroNegocio('Tarefa não encontrada.')
}

export async function excluirTarefa(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('tarefas').delete().eq('id', id)
  lancarSeErro(error, 'Falha ao excluir tarefa')
}
