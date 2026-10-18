'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hojeEmPalmas } from '@/lib/dominio/datas'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  aceitarProposta,
  criarProposta,
  enviarProposta,
  novaVersao,
  recusarProposta,
  salvarItens,
} from '@/lib/servicos/propostas'
import { ErroNegocio, type SupabaseClient } from '@/lib/servicos/tipos'
import { converterItens, type ValoresItem } from '@/lib/propostas-form'
import { dataValida, uuidValido, type RespostaAcao } from '@/lib/validacao'

function revalidarTudo() {
  revalidatePath('/leads/[id]', 'page')
  revalidatePath('/leads/[id]/propostas/[propostaId]', 'page')
  revalidatePath('/hoje')
  revalidatePath('/funil')
}

async function executar(propostaId: string, fn: (db: SupabaseClient) => Promise<void>): Promise<RespostaAcao> {
  if (!uuidValido(propostaId)) return { erro: 'Proposta inválida.' }
  try {
    await fn(await criarClienteServidor())
  } catch (e) {
    if (e instanceof ErroNegocio) {
      revalidarTudo() // o estado pode ter mudado (ex.: toque duplo)
      return { erro: e.message }
    }
    throw e
  }
  revalidarTudo()
  return {}
}

export async function acaoCriarProposta(leadId: string): Promise<RespostaAcao> {
  if (!uuidValido(leadId)) return { erro: 'Lead inválido.' }
  let id: string
  try {
    id = await criarProposta(await criarClienteServidor(), leadId)
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message }
    throw e
  }
  revalidarTudo()
  redirect(`/leads/${leadId}/propostas/${id}`)
}

export async function acaoSalvarItens(propostaId: string, itens: ValoresItem[]): Promise<RespostaAcao> {
  if (!Array.isArray(itens)) return { erro: 'Itens inválidos.' }
  const convertidos = converterItens(itens)
  if ('erro' in convertidos) return { erro: convertidos.erro }
  return executar(propostaId, (db) => salvarItens(db, propostaId, convertidos.itens))
}

export async function acaoNovaVersao(propostaId: string): Promise<RespostaAcao> {
  return executar(propostaId, async (db) => {
    await novaVersao(db, propostaId)
  })
}

export async function acaoEnviarProposta(propostaId: string): Promise<RespostaAcao> {
  return executar(propostaId, (db) => enviarProposta(db, propostaId, hojeEmPalmas()))
}

export async function acaoRecusarProposta(propostaId: string): Promise<RespostaAcao> {
  return executar(propostaId, (db) => recusarProposta(db, propostaId))
}

export async function acaoAceitarProposta(
  propostaId: string,
  v: { diaVencimento: string; primeiroVencimento: string; descricao: string },
): Promise<RespostaAcao> {
  if (!uuidValido(propostaId)) return { erro: 'Proposta inválida.' }
  const dia = Number(v.diaVencimento)
  if (!/^\d{1,2}$/.test(v.diaVencimento.trim()) || dia < 1 || dia > 28) {
    return { erro: 'O dia de vencimento deve ser entre 1 e 28.' }
  }
  if (!dataValida(v.primeiroVencimento)) return { erro: 'Informe a data do 1º vencimento.' }
  let contratoId: string
  try {
    contratoId = await aceitarProposta(await criarClienteServidor(), propostaId, {
      hoje: hojeEmPalmas(),
      diaVencimento: dia,
      primeiroVencimento: v.primeiroVencimento,
      descricao: v.descricao,
    })
  } catch (e) {
    if (e instanceof ErroNegocio) {
      revalidarTudo()
      return { erro: e.message }
    }
    throw e
  }
  revalidarTudo()
  revalidatePath('/clientes')
  redirect(`/clientes/${contratoId}`)
}
