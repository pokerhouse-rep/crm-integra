'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { excluirModelo, salvarConfig, salvarModelo, salvarOpcao } from '@/lib/servicos/config'
import { ErroNegocio, type Opcao, type SupabaseClient } from '@/lib/servicos/tipos'
import { uuidValido, type RespostaAcao } from '@/lib/validacao'

const TIPOS: Opcao['tipo'][] = ['nicho', 'origem', 'motivo_perda']

function revalidar() {
  revalidatePath('/config')
  revalidatePath('/hoje')
  revalidatePath('/leads', 'layout')
  revalidatePath('/funil')
}

async function executar(fn: (db: SupabaseClient) => Promise<unknown>): Promise<RespostaAcao> {
  try {
    await fn(await criarClienteServidor())
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message }
    throw e
  }
  revalidar()
  return {}
}

function paraInteiro(texto: string): number {
  return /^\d+$/.test(texto.trim()) ? Number(texto.trim()) : NaN
}

/** Sequência como texto "2, 5, 10"; dias de reativação como texto. */
export async function acaoSalvarPrazos(sequencia: string, diasReativacao: string): Promise<RespostaAcao> {
  const seq = sequencia.split(/[\s,;]+/).filter(Boolean).map(paraInteiro)
  if (seq.length === 0 || seq.some(Number.isNaN)) {
    return { erro: 'Informe os prazos como números inteiros separados por vírgula (ex.: 2, 5, 10).' }
  }
  const dias = paraInteiro(diasReativacao)
  if (Number.isNaN(dias)) return { erro: 'Informe os dias de reativação como número inteiro.' }
  return executar((db) => salvarConfig(db, { sequenciaPadrao: seq, diasReativacao: dias }))
}

export async function acaoSalvarOpcao(
  id: string | null,
  tipo: string,
  nome: string,
  ativo: boolean,
): Promise<RespostaAcao> {
  if (!TIPOS.includes(tipo as Opcao['tipo'])) return { erro: 'Tipo inválido.' }
  if (id !== null && !uuidValido(id)) return { erro: 'Opção inválida.' }
  return executar((db) => salvarOpcao(db, { id: id ?? undefined, tipo: tipo as Opcao['tipo'], nome, ativo }))
}

export async function acaoSalvarModelo(
  id: string | null,
  nome: string,
  texto: string,
  passo: string,
): Promise<RespostaAcao> {
  if (id !== null && !uuidValido(id)) return { erro: 'Modelo inválido.' }
  const p = passo.trim() === '' ? null : paraInteiro(passo)
  if (p !== null && Number.isNaN(p)) return { erro: 'O passo deve ser um número inteiro positivo ou ficar vazio.' }
  return executar((db) => salvarModelo(db, { id: id ?? undefined, nome, texto, passo: p }))
}

export async function acaoExcluirModelo(id: string): Promise<RespostaAcao> {
  if (!uuidValido(id)) return { erro: 'Modelo inválido.' }
  return executar((db) => excluirModelo(db, id))
}
