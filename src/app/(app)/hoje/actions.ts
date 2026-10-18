'use server'

import { revalidatePath } from 'next/cache'
import { hojeEmPalmas, type DataISO } from '@/lib/dominio/datas'
import type { Resultado } from '@/lib/dominio/tipos'
import { criarClienteServidor } from '@/lib/supabase/server'
import { registrarResultado } from '@/lib/servicos/retornos'
import { concluirTarefa, reagendarTarefa } from '@/lib/servicos/tarefas'
import { ErroNegocio } from '@/lib/servicos/tipos'

export type RespostaAcao = { erro?: string }

const RESULTADOS: Resultado[] = ['respondeu', 'pediu_tempo', 'sem_interesse', 'sem_resposta']
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

async function executar(fn: () => Promise<void>): Promise<RespostaAcao> {
  try {
    await fn()
  } catch (e) {
    if (e instanceof ErroNegocio) {
      revalidatePath('/hoje') // o item pode já ter mudado de estado (ex.: toque duplo)
      return { erro: e.message }
    }
    throw e
  }
  revalidatePath('/hoje')
  return {}
}

export async function acaoResultado(
  retornoId: string,
  resultado: Resultado,
  novaData?: DataISO,
  motivoPerdaId?: string,
): Promise<RespostaAcao> {
  if (!RESULTADOS.includes(resultado)) return { erro: 'Resultado inválido.' }
  if (novaData !== undefined && !DATA_ISO.test(novaData)) return { erro: 'Data inválida.' }
  return executar(async () => {
    const db = await criarClienteServidor()
    await registrarResultado(db, retornoId, { resultado, novaData, motivoPerdaId, hoje: hojeEmPalmas() })
  })
}

export async function acaoConcluirTarefa(id: string): Promise<RespostaAcao> {
  return executar(async () => {
    await concluirTarefa(await criarClienteServidor(), id)
  })
}

export async function acaoReagendarTarefa(id: string, data: DataISO, hora: string | null): Promise<RespostaAcao> {
  if (!DATA_ISO.test(data)) return { erro: 'Data inválida.' }
  return executar(async () => {
    await reagendarTarefa(await criarClienteServidor(), id, data, hora)
  })
}
