'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { excluirModelo, salvarConfig, salvarModelo, salvarOpcao } from '@/lib/servicos/config'
import { ErroNegocio, type Opcao, type SupabaseClient } from '@/lib/servicos/tipos'
import { lerReais } from '@/lib/dominio/dinheiro'
import { salvarServico } from '@/lib/servicos/catalogo'
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

/** Sequência como texto "2, 5, 10"; dias como texto. */
export async function acaoSalvarPrazos(v: {
  sequencia: string
  diasReativacao: string
  diasRetornoProposta: string
  diasLembreteCobranca: string
}): Promise<RespostaAcao> {
  const seq = v.sequencia.split(/[\s,;]+/).filter(Boolean).map(paraInteiro)
  if (seq.length === 0 || seq.some(Number.isNaN)) {
    return { erro: 'Informe os prazos como números inteiros separados por vírgula (ex.: 2, 5, 10).' }
  }
  const diasReativacao = paraInteiro(v.diasReativacao)
  if (Number.isNaN(diasReativacao)) return { erro: 'Informe os dias de reativação como número inteiro.' }
  const diasRetornoProposta = paraInteiro(v.diasRetornoProposta)
  if (Number.isNaN(diasRetornoProposta)) return { erro: 'Informe os dias de retorno após proposta como número inteiro.' }
  const diasLembreteCobranca = paraInteiro(v.diasLembreteCobranca)
  if (Number.isNaN(diasLembreteCobranca)) return { erro: 'Informe os dias de lembrete de cobrança como número inteiro.' }
  return executar((db) =>
    salvarConfig(db, { sequenciaPadrao: seq, diasReativacao, diasRetornoProposta, diasLembreteCobranca }),
  )
}

export async function acaoSalvarServico(
  id: string | null,
  nome: string,
  tipo: string,
  preco: string,
  ativo: boolean,
): Promise<RespostaAcao> {
  if (tipo !== 'unico' && tipo !== 'recorrente') return { erro: 'Tipo inválido.' }
  if (id !== null && !uuidValido(id)) return { erro: 'Serviço inválido.' }
  const precoCentavos = preco.trim() === '' ? 0 : lerReais(preco)
  if (precoCentavos === null) return { erro: 'Informe um preço válido (ex.: 1.500,00).' }
  return executar((db) => salvarServico(db, { id: id ?? undefined, nome, tipo, precoCentavos, ativo }))
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
