import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { criarClienteComContrato, criarUsuarioTeste } from './helpers'
import { garantirMensalidades } from '@/lib/servicos/cobrancas'
import {
  cancelarContrato,
  listarContratos,
  mrrAtivo,
  obterContrato,
  pausarContrato,
  reajustarMensalidade,
  reativarContrato,
} from '@/lib/servicos/contratos'
import { obterLead } from '@/lib/servicos/leads'

async function todas(cliente: SupabaseClient) {
  const { data, error } = await cliente.from('cobrancas').select('*').order('vencimento').order('tipo')
  if (error) throw new Error(error.message)
  return data!
}

const resumo = (cs: Awaited<ReturnType<typeof todas>>) =>
  cs.map((c) => `${c.tipo === 'mensalidade' ? c.competencia!.slice(0, 7) : `p${c.numero}`}:${c.status}`)

async function itemDoTipo(cliente: SupabaseClient, contratoId: string, tipo: 'unico' | 'recorrente') {
  const { data } = await cliente.from('contrato_itens').select('id').eq('contrato_id', contratoId).eq('tipo', tipo).single()
  return data!.id as string
}

describe('ciclo de vida do contrato', () => {
  it('pausar em 01/11 suspende as cobranças a partir de 01/11 e mantém a parcela de 19/10 aberta', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId, leadId } = await criarClienteComContrato(cliente)
    await pausarContrato(cliente, contratoId, '2026-11-01')
    expect(resumo(await todas(cliente))).toEqual(['p1:aberta', 'p2:suspensa', '2026-11:suspensa', 'p3:suspensa'])
    const { contrato } = await obterContrato(cliente, contratoId, '2026-11-02')
    expect(contrato).toMatchObject({ status: 'pausado', pausado_em: '2026-11-01' })
    const det = await obterLead(cliente, leadId)
    expect(det.eventos.filter((e) => e.tipo === 'contrato_pausado')).toHaveLength(1)
    await expect(pausarContrato(cliente, contratoId, '2026-11-01')).rejects.toThrow('Este contrato não está ativo.')
  })

  it('contrato pausado: mensalidades novas nascem suspensas e o contrato sai do MRR', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    expect(mrrAtivo(await listarContratos(cliente, '2026-11-02'))).toBe(15000)
    await pausarContrato(cliente, contratoId, '2026-11-01')
    expect(await garantirMensalidades(cliente, '2026-12-05')).toBe(2)
    const novas = (await todas(cliente)).filter((c) => c.tipo === 'mensalidade' && c.competencia! >= '2026-12-01')
    expect(novas.map((c) => c.status)).toEqual(['suspensa', 'suspensa'])
    const lista = await listarContratos(cliente, '2026-12-05')
    expect(mrrAtivo(lista)).toBe(0)
    expect(lista[0].mensalidadeVigenteCentavos).toBe(0)
  })

  it('reativar em 05/01/2027: parcelas voltam a abertas, mensalidades de nov e dez ficam suspensas, janeiro volta a aberta', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId, leadId } = await criarClienteComContrato(cliente)
    await pausarContrato(cliente, contratoId, '2026-11-01')
    await garantirMensalidades(cliente, '2026-12-05')
    await reativarContrato(cliente, contratoId, '2027-01-05')
    expect(resumo(await todas(cliente))).toEqual([
      'p1:aberta',
      'p2:aberta',
      '2026-11:suspensa',
      'p3:aberta',
      '2026-12:suspensa',
      '2027-01:aberta',
      '2027-02:aberta',
    ])
    const { contrato } = await obterContrato(cliente, contratoId, '2027-01-05')
    expect(contrato).toMatchObject({ status: 'ativo', pausado_em: null })
    expect(contrato.mensalidadeVigenteCentavos).toBe(15000)
    const det = await obterLead(cliente, leadId)
    expect(det.eventos.filter((e) => e.tipo === 'contrato_reativado')).toHaveLength(1)
    await expect(reativarContrato(cliente, contratoId, '2027-01-05')).rejects.toThrow('Este contrato não está pausado.')
  })

  it('reativar sem garantirMensalidades durante a pausa cria nov e dez suspensas e janeiro aberta', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    await pausarContrato(cliente, contratoId, '2026-11-01')
    await reativarContrato(cliente, contratoId, '2027-01-05')
    const mens = (await todas(cliente)).filter((c) => c.tipo === 'mensalidade')
    expect(mens.map((c) => [c.competencia, c.status])).toEqual([
      ['2026-11-01', 'suspensa'],
      ['2026-12-01', 'suspensa'],
      ['2027-01-01', 'aberta'],
      ['2027-02-01', 'aberta'],
    ])
  })

  it('cancelar em 01/12 apaga as não pagas de 01/12 em diante, mantém a paga e a vencida, e o MRR fica 0', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId, leadId } = await criarClienteComContrato(cliente)
    const p1 = (await todas(cliente)).find((c) => c.numero === 1)!
    await cliente.from('cobrancas').update({ status: 'paga', pago_em: '2026-10-19', valor_pago_centavos: 50000 }).eq('id', p1.id)
    await garantirMensalidades(cliente, '2026-12-01')
    await cancelarContrato(cliente, contratoId, '2026-12-01')
    expect(resumo(await todas(cliente))).toEqual(['p1:paga', 'p2:aberta', '2026-11:aberta'])
    const { contrato } = await obterContrato(cliente, contratoId, '2026-12-01')
    expect(contrato).toMatchObject({ status: 'cancelado', cancelado_em: '2026-12-01' })
    expect(mrrAtivo(await listarContratos(cliente, '2026-12-01'))).toBe(0)
    expect(await garantirMensalidades(cliente, '2027-03-01')).toBe(0)
    const det = await obterLead(cliente, leadId)
    expect(det.eventos.filter((e) => e.tipo === 'contrato_cancelado')).toHaveLength(1)
  })

  it('reajuste para 180,00 a partir de 2027-01: janeiro aberto recalculado, dezembro continua 150,00, e fevereiro nasce com 180,00', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId, leadId } = await criarClienteComContrato(cliente)
    await garantirMensalidades(cliente, '2026-12-05')
    const itemId = await itemDoTipo(cliente, contratoId, 'recorrente')
    await reajustarMensalidade(cliente, itemId, { valorCentavos: 18000, aPartirDe: '2027-01-01' })
    await garantirMensalidades(cliente, '2027-01-10')
    const mens = (await todas(cliente)).filter((c) => c.tipo === 'mensalidade')
    expect(mens.map((c) => [c.competencia, Number(c.valor_centavos)])).toEqual([
      ['2026-11-01', 15000],
      ['2026-12-01', 15000],
      ['2027-01-01', 18000],
      ['2027-02-01', 18000],
    ])
    const det = await obterContrato(cliente, contratoId, '2027-01-10')
    expect(det.reajustes).toHaveLength(1)
    expect(det.contrato.mensalidadeVigenteCentavos).toBe(18000)
    const lead = await obterLead(cliente, leadId)
    expect(lead.eventos.filter((e) => e.tipo === 'contrato_reajustado')).toHaveLength(1)
    // Segundo reajuste no mesmo mês substitui o primeiro.
    await reajustarMensalidade(cliente, itemId, { valorCentavos: 19000, aPartirDe: '2027-01-01' })
    expect((await obterContrato(cliente, contratoId, '2027-01-10')).reajustes).toHaveLength(1)
    const jan = (await todas(cliente)).find((c) => c.competencia === '2027-01-01')!
    expect(Number(jan.valor_centavos)).toBe(19000)
  })

  it('cancelar contrato pausado reabre parcela vencida, descarta mensalidade pausada e apaga o futuro', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    await pausarContrato(cliente, contratoId, '2026-11-01')
    await cancelarContrato(cliente, contratoId, '2026-12-01')
    const resto = await todas(cliente)
    expect(resumo(resto)).toEqual(['p1:aberta', 'p2:aberta'])
    expect(resto.find((c) => c.numero === 2)!.vencimento).toBe('2026-11-19')
  })

  it('MRR só conta item com mês de início já chegado', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    expect(mrrAtivo(await listarContratos(cliente, '2026-10-25'))).toBe(0)
    expect(mrrAtivo(await listarContratos(cliente, '2026-11-05'))).toBe(15000)
  })

  it('reajuste com data que não é dia 1 falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    const itemId = await itemDoTipo(cliente, contratoId, 'recorrente')
    await expect(reajustarMensalidade(cliente, itemId, { valorCentavos: 18000, aPartirDe: '2027-01-15' })).rejects.toThrow(
      'Informe o mês do reajuste.',
    )
  })

  it('reajuste vale só até o próximo reajuste do mesmo item', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    await garantirMensalidades(cliente, '2027-02-10')
    const itemId = await itemDoTipo(cliente, contratoId, 'recorrente')
    await reajustarMensalidade(cliente, itemId, { valorCentavos: 21000, aPartirDe: '2027-03-01' })
    await reajustarMensalidade(cliente, itemId, { valorCentavos: 19000, aPartirDe: '2027-01-01' })
    const mens = (await todas(cliente)).filter((c) => c.tipo === 'mensalidade')
    expect(mens.map((c) => [c.competencia, Number(c.valor_centavos)])).toEqual([
      ['2026-11-01', 15000],
      ['2026-12-01', 15000],
      ['2027-01-01', 19000],
      ['2027-02-01', 19000],
      ['2027-03-01', 21000],
    ])
  })

  it('reajustar item de valor único falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    const unico = await itemDoTipo(cliente, contratoId, 'unico')
    await expect(reajustarMensalidade(cliente, unico, { valorCentavos: 18000, aPartirDe: '2027-01-01' })).rejects.toThrow(
      'Só mensalidades podem ser reajustadas.',
    )
    const itemId = await itemDoTipo(cliente, contratoId, 'recorrente')
    await expect(reajustarMensalidade(cliente, itemId, { valorCentavos: 0, aPartirDe: '2027-01-01' })).rejects.toThrow(
      'Informe o novo valor da mensalidade.',
    )
  })

  it('pausar contrato cancelado falha com "Contrato cancelado não pode ser alterado."', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    await cancelarContrato(cliente, contratoId, '2026-12-01')
    const msg = 'Contrato cancelado não pode ser alterado.'
    await expect(pausarContrato(cliente, contratoId, '2026-12-02')).rejects.toThrow(msg)
    await expect(reativarContrato(cliente, contratoId, '2026-12-02')).rejects.toThrow(msg)
    await expect(cancelarContrato(cliente, contratoId, '2026-12-02')).rejects.toThrow(msg)
    const itemId = await itemDoTipo(cliente, contratoId, 'recorrente')
    await expect(reajustarMensalidade(cliente, itemId, { valorCentavos: 18000, aPartirDe: '2027-01-01' })).rejects.toThrow(msg)
  })

  it('obterContrato inexistente falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    await expect(obterContrato(cliente, '00000000-0000-0000-0000-000000000000', '2026-11-01')).rejects.toThrow(
      'Contrato não encontrado.',
    )
  })
})
