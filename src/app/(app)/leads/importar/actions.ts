'use server'

import { revalidatePath } from 'next/cache'
import type { LinhaImportacao } from '@/lib/dominio/importacao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { importarLeads, previaImportacao } from '@/lib/servicos/importacao'
import { ErroNegocio, type DadosLead } from '@/lib/servicos/tipos'
import { uuidValido, type RespostaAcao } from '@/lib/validacao'

export interface RespostaPrevia extends RespostaAcao {
  linhas?: LinhaImportacao[]
  ignoradas?: string[]
}

export interface RespostaImportacao extends RespostaAcao {
  importados?: number
  ignorados?: number
}

function idOpcional(v: FormDataEntryValue | null): string | null | undefined {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  return uuidValido(s) ? s : undefined
}

export async function acaoPreviaImportacao(form: FormData): Promise<RespostaPrevia> {
  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha um arquivo CSV.' }
  const nichoId = idOpcional(form.get('nichoId'))
  const origemId = idOpcional(form.get('origemId'))
  if (nichoId === undefined || origemId === undefined) return { erro: 'Opção inválida.' }
  try {
    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    return await previaImportacao(await criarClienteServidor(), bytes, { nichoId, origemId })
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message }
    throw e
  }
}

export async function acaoConfirmarImportacao(leads: DadosLead[]): Promise<RespostaImportacao> {
  if (!Array.isArray(leads) || leads.length === 0) return { erro: 'Não há leads novos para importar.' }
  const idsOk = leads.every(
    (l) =>
      typeof l?.nomeContato === 'string' &&
      typeof l?.whatsapp === 'string' &&
      (!l.nichoId || uuidValido(l.nichoId)) &&
      (!l.origemId || uuidValido(l.origemId)),
  )
  if (!idsOk) return { erro: 'Há linhas inválidas. Gere a prévia de novo.' }
  try {
    const r = await importarLeads(await criarClienteServidor(), leads)
    revalidatePath('/leads')
    revalidatePath('/funil')
    revalidatePath('/hoje')
    return r
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message }
    throw e
  }
}
