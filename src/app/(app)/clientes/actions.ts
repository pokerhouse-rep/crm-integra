'use server'

import { revalidatePath } from 'next/cache'
import { hojeEmPalmas } from '@/lib/dominio/datas'
import { lerReais } from '@/lib/dominio/dinheiro'
import { criarClienteServidor } from '@/lib/supabase/server'
import { desfazerPagamento, editarCobranca, marcarPago } from '@/lib/servicos/cobrancas'
import {
  cancelarContrato,
  pausarContrato,
  reativarContrato,
  reajustarMensalidade,
} from '@/lib/servicos/contratos'
import { ErroNegocio, type SupabaseClient } from '@/lib/servicos/tipos'
import { dataValida, uuidValido, type RespostaAcao } from '@/lib/validacao'

function revalidarTudo() {
  revalidatePath('/hoje')
  revalidatePath('/leads/[id]', 'page')
  revalidatePath('/clientes', 'layout')
}

async function executar(
  id: unknown,
  rotulo: string,
  fn: (db: SupabaseClient) => Promise<void>,
  revalidar = true,
): Promise<RespostaAcao> {
  if (typeof id !== 'string' || !uuidValido(id)) return { erro: `${rotulo} inválido.` }
  try {
    await fn(await criarClienteServidor())
  } catch (e) {
    // Sem revalidar no erro: o aviso não se perde com a remontagem da tela.
    if (e instanceof ErroNegocio) return { erro: e.message }
    throw e
  }
  if (revalidar) revalidarTudo()
  return {}
}

export async function acaoMarcarPago(cobrancaId: string, pagoEm?: string, valor?: string): Promise<RespostaAcao> {
  if (pagoEm !== undefined && (typeof pagoEm !== 'string' || !dataValida(pagoEm))) {
    return { erro: 'Informe uma data de pagamento válida.' }
  }
  if (valor !== undefined && typeof valor !== 'string') return { erro: 'Valor inválido.' }
  let centavos: number | undefined
  if (valor !== undefined && valor.trim() !== '') {
    const lido = lerReais(valor)
    if (lido === null || lido <= 0) return { erro: 'Valor recebido inválido. Exemplo: 1.500,00' }
    centavos = lido
  }
  // Sem revalidar: o cartão fica na tela com "Recebido · R$ X — Desfazer" (em Hoje ele sumiria na hora).
  // As telas são dinâmicas, então ao navegar os dados vêm atualizados; "Desfazer" revalida.
  return executar(
    cobrancaId,
    'Cobrança',
    (db) => marcarPago(db, cobrancaId, { pagoEm: pagoEm ?? hojeEmPalmas(), valorPagoCentavos: centavos }),
    false,
  )
}

export async function acaoDesfazerPagamento(cobrancaId: string): Promise<RespostaAcao> {
  return executar(cobrancaId, 'Cobrança', (db) => desfazerPagamento(db, cobrancaId))
}

export async function acaoEditarCobranca(cobrancaId: string, vencimento: string, valor: string): Promise<RespostaAcao> {
  if (typeof vencimento !== 'string' || !dataValida(vencimento)) return { erro: 'Informe um vencimento válido.' }
  if (typeof valor !== 'string') return { erro: 'Valor inválido.' }
  const centavos = lerReais(valor)
  if (centavos === null || centavos <= 0) return { erro: 'Valor inválido. Exemplo: 1.500,00' }
  return executar(cobrancaId, 'Cobrança', (db) =>
    editarCobranca(db, cobrancaId, { vencimento, valorCentavos: centavos }),
  )
}

export async function acaoPausarContrato(contratoId: string): Promise<RespostaAcao> {
  return executar(contratoId, 'Contrato', (db) => pausarContrato(db, contratoId, hojeEmPalmas()))
}

export async function acaoReativarContrato(contratoId: string): Promise<RespostaAcao> {
  return executar(contratoId, 'Contrato', (db) => reativarContrato(db, contratoId, hojeEmPalmas()))
}

export async function acaoCancelarContrato(contratoId: string): Promise<RespostaAcao> {
  return executar(contratoId, 'Contrato', (db) => cancelarContrato(db, contratoId, hojeEmPalmas()))
}

/** `aPartirDe` no formato 'YYYY-MM' (competência). */
export async function acaoReajustar(itemId: string, valor: string, aPartirDe: string): Promise<RespostaAcao> {
  if (typeof valor !== 'string' || typeof aPartirDe !== 'string') return { erro: 'Dados do reajuste inválidos.' }
  if (!/^\d{4}-\d{2}$/.test(aPartirDe) || !dataValida(`${aPartirDe}-01`)) return { erro: 'Informe o mês do reajuste.' }
  const centavos = lerReais(valor)
  if (centavos === null || centavos <= 0) return { erro: 'Informe o novo valor da mensalidade. Exemplo: 180,00' }
  return executar(itemId, 'Item', (db) => reajustarMensalidade(db, itemId, { valorCentavos: centavos, aPartirDe: `${aPartirDe}-01` }))
}
