import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { criarClienteComContrato, criarUsuarioTeste } from './helpers'
import {
  cobrancasDoPainel,
  desfazerPagamento,
  editarCobranca,
  garantirMensalidades,
  listarCobrancas,
  marcarPago,
} from '@/lib/servicos/cobrancas'
import { cancelarContrato, pausarContrato, reajustarMensalidade } from '@/lib/servicos/contratos'
import { obterLead } from '@/lib/servicos/leads'

async function todas(cliente: SupabaseClient) {
  const { data, error } = await cliente.from('cobrancas').select('*').order('vencimento').order('tipo')
  if (error) throw new Error(error.message)
  return data!
}

async function achar(cliente: SupabaseClient, tipo: string, numero: number | null) {
  const c = (await todas(cliente)).find((x) => x.tipo === tipo && x.numero === numero)
  if (!c) throw new Error('cobrança não encontrada no teste')
  return c
}

describe('cobranças', () => {
  it('garantirMensalidades em 05/12 cria dezembro e janeiro e não duplica', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    expect(await garantirMensalidades(cliente, '2026-12-05')).toBe(2)
    expect(await garantirMensalidades(cliente, '2026-12-05')).toBe(0)
    await Promise.all([garantirMensalidades(cliente, '2027-02-03'), garantirMensalidades(cliente, '2027-02-03')])
    const comps = (await todas(cliente)).filter((c) => c.tipo === 'mensalidade').map((c) => c.competencia).sort()
    expect(comps).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01'])
  })

  it('painel em 15/11 não mostra nada vencendo; em 16/11 mostra parcela 2 e mensalidade de 19/11', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    expect((await cobrancasDoPainel(cliente, '2026-11-15')).vencendo).toEqual([])
    const p = await cobrancasDoPainel(cliente, '2026-11-16')
    expect(p.vencendo.map((c) => [c.rotulo, c.vencimento]).sort()).toEqual([
      ['Hospedagem · mensalidade 11/2026', '2026-11-19'],
      ['Site institucional · parcela 2 de 3', '2026-11-19'],
    ])
    expect(p.vencendo[0].lead.nome_contato).toBe('Cliente Teste')
    expect(p.vencendo[0].contratoDescricao).toBeTruthy()
  })

  it('painel em 20/11 mostra como atrasadas a parcela 1 (não paga) e as de 19/11', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    const p = await cobrancasDoPainel(cliente, '2026-11-20')
    expect(p.atrasadas.map((c) => c.vencimento)).toEqual(['2026-10-19', '2026-11-19', '2026-11-19'])
    expect(p.vencendo).toEqual([])
    const atrasadas = await listarCobrancas(cliente, { atrasadas: true }, '2026-11-20')
    expect(atrasadas).toHaveLength(3)
  })

  it('marcarPago grava data e valor; segunda vez falha com "Esta cobrança já foi paga."', async () => {
    const { cliente, userId } = await criarUsuarioTeste()
    const { leadId } = await criarClienteComContrato(cliente)
    const c = await achar(cliente, 'parcela', 1)
    await marcarPago(cliente, c.id, { pagoEm: '2026-10-20' })
    const depois = await achar(cliente, 'parcela', 1)
    expect(depois).toMatchObject({ status: 'paga', pago_em: '2026-10-20', user_id: userId })
    expect(Number(depois.valor_pago_centavos)).toBe(50000)
    await expect(marcarPago(cliente, c.id, { pagoEm: '2026-10-20' })).rejects.toThrow('Esta cobrança já foi paga.')
    const det = await obterLead(cliente, leadId)
    const ev = det.eventos.filter((e) => e.tipo === 'cobranca_paga')
    expect(ev).toHaveLength(1)
    expect(ev[0].dados).toEqual({ cobranca_id: c.id, valor: 50000 })
  })

  it('marcarPago com valor diferente guarda o valor recebido e sai do painel', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    const c = await achar(cliente, 'parcela', 1)
    await marcarPago(cliente, c.id, { pagoEm: '2026-10-20', valorPagoCentavos: 40000 })
    expect(Number((await achar(cliente, 'parcela', 1)).valor_pago_centavos)).toBe(40000)
    const p = await cobrancasDoPainel(cliente, '2026-10-21')
    expect([...p.atrasadas, ...p.vencendo].find((x) => x.id === c.id)).toBeUndefined()
  })

  it('marcarPago com valor 0 ou inválido falha com "Valor recebido inválido."', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    const c = await achar(cliente, 'parcela', 1)
    await expect(marcarPago(cliente, c.id, { pagoEm: '2026-10-20', valorPagoCentavos: 0 })).rejects.toThrow('Valor recebido inválido.')
    await expect(marcarPago(cliente, c.id, { pagoEm: '2026-10-20', valorPagoCentavos: 10.5 })).rejects.toThrow('Valor recebido inválido.')
    const { error } = await cliente.rpc('marcar_pago', { p_cobranca_id: c.id, p_pago_em: '2026-10-20', p_valor_pago: 0 })
    expect(error?.message).toBe('Valor recebido inválido.')
    expect((await achar(cliente, 'parcela', 1)).status).toBe('aberta')
  })

  it('marcarPago em cobrança suspensa falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    const c = await achar(cliente, 'parcela', 2)
    await cliente.from('cobrancas').update({ status: 'suspensa' }).eq('id', c.id)
    await expect(marcarPago(cliente, c.id, { pagoEm: '2026-11-19' })).rejects.toThrow(
      'Cobrança suspensa: reative o contrato para receber.',
    )
  })

  it('desfazerPagamento volta a cobrança para aberta', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { leadId } = await criarClienteComContrato(cliente)
    const c = await achar(cliente, 'parcela', 1)
    await expect(desfazerPagamento(cliente, c.id)).rejects.toThrow('Esta cobrança não está paga.')
    await marcarPago(cliente, c.id, { pagoEm: '2026-10-20' })
    await desfazerPagamento(cliente, c.id)
    expect(await achar(cliente, 'parcela', 1)).toMatchObject({ status: 'aberta', pago_em: null, valor_pago_centavos: null })
    const det = await obterLead(cliente, leadId)
    expect(det.eventos.filter((e) => e.tipo === 'pagamento_desfeito')).toHaveLength(1)
  })

  it('listarCobrancas do mês 2026-11 traz parcela 2 e mensalidade com rótulos', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    const lista = await listarCobrancas(cliente, { mes: '2026-11' }, '2026-11-01')
    expect(lista.map((c) => c.rotulo).sort()).toEqual([
      'Hospedagem · mensalidade 11/2026',
      'Site institucional · parcela 2 de 3',
    ])
  })

  it('editarCobranca muda o vencimento de uma aberta; numa paga falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    const c = await achar(cliente, 'parcela', 2)
    await editarCobranca(cliente, c.id, { vencimento: '2026-11-25', valorCentavos: 44000 })
    const depois = await achar(cliente, 'parcela', 2)
    expect(depois.vencimento).toBe('2026-11-25')
    expect(Number(depois.valor_centavos)).toBe(44000)
    await marcarPago(cliente, c.id, { pagoEm: '2026-11-25' })
    await expect(editarCobranca(cliente, c.id, { vencimento: '2026-11-30' })).rejects.toThrow(
      'Só é possível editar cobranças não pagas.',
    )
  })

  it('desfazerPagamento em contrato pausado volta como suspensa se vence a partir da pausa', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    const p1 = await achar(cliente, 'parcela', 1)
    const p2 = await achar(cliente, 'parcela', 2)
    await marcarPago(cliente, p1.id, { pagoEm: '2026-10-20' })
    await marcarPago(cliente, p2.id, { pagoEm: '2026-10-30' })
    await pausarContrato(cliente, contratoId, '2026-11-01')
    await desfazerPagamento(cliente, p2.id)
    await desfazerPagamento(cliente, p1.id)
    expect((await achar(cliente, 'parcela', 2)).status).toBe('suspensa')
    expect((await achar(cliente, 'parcela', 1)).status).toBe('aberta')
  })

  it('desfazerPagamento em contrato cancelado: falha se vence a partir do cancelamento; antes volta aberta', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    const p1 = await achar(cliente, 'parcela', 1)
    const p2 = await achar(cliente, 'parcela', 2)
    await marcarPago(cliente, p1.id, { pagoEm: '2026-10-20' })
    await marcarPago(cliente, p2.id, { pagoEm: '2026-10-30' })
    await cancelarContrato(cliente, contratoId, '2026-11-01')
    await expect(desfazerPagamento(cliente, p2.id)).rejects.toThrow(
      'Contrato cancelado: este pagamento não pode ser desfeito.',
    )
    expect((await achar(cliente, 'parcela', 2)).status).toBe('paga')
    await desfazerPagamento(cliente, p1.id)
    expect((await achar(cliente, 'parcela', 1)).status).toBe('aberta')
  })

  it('a lista traz status e data de cancelamento do contrato', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    const p1 = await achar(cliente, 'parcela', 1)
    await marcarPago(cliente, p1.id, { pagoEm: '2026-10-20' })
    await cancelarContrato(cliente, contratoId, '2026-10-19')
    const lista = await listarCobrancas(cliente, { mes: '2026-10' }, '2026-10-19')
    expect(lista.find((c) => c.id === p1.id)).toMatchObject({ contratoStatus: 'cancelado', contratoCanceladoEm: '2026-10-19' })
  })
})

describe('auto-cura das mensalidades (sanear_mensalidades)', () => {
  async function inserirMensalidade(cliente: SupabaseClient, contratoId: string, competencia: string, valor: number) {
    const { data: item } = await cliente.from('contrato_itens').select('id').eq('contrato_id', contratoId).eq('tipo', 'recorrente').single()
    const { data: contrato } = await cliente.from('contratos').select('lead_id').eq('id', contratoId).single()
    const { data, error } = await cliente
      .from('cobrancas')
      .insert({
        contrato_id: contratoId,
        contrato_item_id: item!.id,
        lead_id: contrato!.lead_id,
        tipo: 'mensalidade',
        competencia,
        vencimento: `${competencia.slice(0, 8)}19`,
        valor_centavos: valor,
        status: 'aberta',
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return data!.id as string
  }

  async function porId(cliente: SupabaseClient, id: string) {
    const { data } = await cliente.from('cobrancas').select('*').eq('id', id).maybeSingle()
    return data
  }

  it('apaga mensalidade aberta criada depois do cancelamento', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    await cancelarContrato(cliente, contratoId, '2026-11-05')
    const id = await inserirMensalidade(cliente, contratoId, '2027-01-01', 15000)
    await garantirMensalidades(cliente, '2026-11-05')
    expect(await porId(cliente, id)).toBeNull()
  })

  it('suspende mensalidade aberta criada durante a pausa', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    await pausarContrato(cliente, contratoId, '2026-11-05')
    const id = await inserirMensalidade(cliente, contratoId, '2027-01-01', 15000)
    await garantirMensalidades(cliente, '2026-11-05')
    expect((await porId(cliente, id))!.status).toBe('suspensa')
  })

  it('recalcula mensalidade com valor antigo numa competência reajustada, mas preserva edição manual', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { contratoId } = await criarClienteComContrato(cliente)
    await garantirMensalidades(cliente, '2026-11-05') // novembro e dezembro
    const { data: item } = await cliente.from('contrato_itens').select('id').eq('contrato_id', contratoId).eq('tipo', 'recorrente').single()
    await reajustarMensalidade(cliente, item!.id, { valorCentavos: 18000, aPartirDe: '2026-12-01' })
    const jan = await inserirMensalidade(cliente, contratoId, '2027-01-01', 15000)
    const dez = (await todas(cliente)).find((c) => c.competencia === '2026-12-01')!
    expect(Number(dez.valor_centavos)).toBe(18000)
    await editarCobranca(cliente, dez.id, { valorCentavos: 12345 })
    expect(await garantirMensalidades(cliente, '2026-11-05')).toBe(0)
    expect(Number((await porId(cliente, jan))!.valor_centavos)).toBe(18000)
    expect(Number((await porId(cliente, dez.id))!.valor_centavos)).toBe(12345)
    const nov = (await todas(cliente)).find((c) => c.competencia === '2026-11-01')!
    expect(Number(nov.valor_centavos)).toBe(15000)
  })
})
