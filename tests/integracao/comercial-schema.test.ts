import { describe, expect, it } from 'vitest'
import { criarUsuarioTeste } from './helpers'

type Usuario = Awaited<ReturnType<typeof criarUsuarioTeste>>

async function criarLead(u: Usuario) {
  const { data, error } = await u.cliente
    .from('leads')
    .insert({ nome_contato: 'Contato', whatsapp: `55${Date.now()}${Math.floor(Math.random() * 1000)}` })
    .select('id')
    .single()
  expect(error).toBeNull()
  return data!.id as string
}

async function criarVersao(u: Usuario) {
  const leadId = await criarLead(u)
  const { data: proposta, error } = await u.cliente
    .from('propostas')
    .insert({ lead_id: leadId })
    .select('id')
    .single()
  expect(error).toBeNull()
  const { data: versao, error: e2 } = await u.cliente
    .from('versoes_proposta')
    .insert({ proposta_id: proposta!.id, numero: 1 })
    .select('id')
    .single()
  expect(e2).toBeNull()
  return { leadId, propostaId: proposta!.id as string, versaoId: versao!.id as string }
}

describe('schema comercial', () => {
  it('novo usuário recebe 5 serviços no catálogo (3 únicos, 2 recorrentes)', async () => {
    const u = await criarUsuarioTeste()
    const { data, error } = await u.cliente.from('catalogo_servicos').select('nome, tipo, preco_centavos, ordem')
    expect(error).toBeNull()
    expect(data).toHaveLength(5)
    expect(data!.filter((s) => s.tipo === 'unico')).toHaveLength(3)
    expect(data!.filter((s) => s.tipo === 'recorrente')).toHaveLength(2)
    expect(data!.every((s) => s.preco_centavos === 0)).toBe(true)
    expect(data!.map((s) => s.ordem).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('RLS isola propostas, contratos e cobranças', async () => {
    const a = await criarUsuarioTeste()
    const b = await criarUsuarioTeste()
    const leadId = await criarLead(a)
    const p = await a.cliente.from('propostas').insert({ lead_id: leadId }).select('id').single()
    expect(p.error).toBeNull()
    const c = await a.cliente
      .from('contratos')
      .insert({ lead_id: leadId, descricao: 'Contrato', dia_vencimento: 10, data_inicio: '2026-10-18' })
      .select('id')
      .single()
    expect(c.error).toBeNull()
    const ci = await a.cliente
      .from('contrato_itens')
      .insert({ contrato_id: c.data!.id, descricao: 'Item', tipo: 'unico', valor_centavos: 1000 })
      .select('id')
      .single()
    expect(ci.error).toBeNull()
    const cob = await a.cliente.from('cobrancas').insert({
      contrato_id: c.data!.id, contrato_item_id: ci.data!.id, lead_id: leadId,
      tipo: 'avista', vencimento: '2026-10-18', valor_centavos: 1000,
    })
    expect(cob.error).toBeNull()

    for (const tabela of ['propostas', 'contratos', 'contrato_itens', 'cobrancas']) {
      const r = await b.cliente.from(tabela).select('id')
      expect(r.error).toBeNull()
      expect(r.data).toHaveLength(0)
    }
  })

  it('item de proposta rejeita valor zero e parcelas fora de 1 a 48', async () => {
    const u = await criarUsuarioTeste()
    const { versaoId } = await criarVersao(u)
    const base = { versao_id: versaoId, ordem: 1, descricao: 'Site', tipo: 'unico' }
    for (const extra of [{ valor_centavos: 0 }, { valor_centavos: 100, parcelas: 0 }, { valor_centavos: 100, parcelas: 49 }]) {
      const r = await u.cliente.from('itens_proposta').insert({ ...base, ...extra })
      expect(r.error?.code).toBe('23514')
    }
    const ok = await u.cliente.from('itens_proposta').insert({ ...base, valor_centavos: 100, parcelas: 48 })
    expect(ok.error).toBeNull()
  })

  it('item recorrente sem mês de início é rejeitado', async () => {
    const u = await criarUsuarioTeste()
    const { versaoId } = await criarVersao(u)
    const r = await u.cliente
      .from('itens_proposta')
      .insert({ versao_id: versaoId, ordem: 1, descricao: 'Hospedagem', tipo: 'recorrente', valor_centavos: 5000 })
    expect(r.error?.code).toBe('23514')
  })

  it('não há duas mensalidades da mesma competência para o mesmo item', async () => {
    const u = await criarUsuarioTeste()
    const leadId = await criarLead(u)
    const c = await u.cliente
      .from('contratos')
      .insert({ lead_id: leadId, descricao: 'Contrato', dia_vencimento: 10, data_inicio: '2026-10-18' })
      .select('id')
      .single()
    const ci = await u.cliente
      .from('contrato_itens')
      .insert({ contrato_id: c.data!.id, descricao: 'Hospedagem', tipo: 'recorrente', valor_centavos: 5000, mes_inicio: '2026-11-01' })
      .select('id')
      .single()
    const linha = {
      contrato_id: c.data!.id, contrato_item_id: ci.data!.id, lead_id: leadId,
      tipo: 'mensalidade', competencia: '2026-11-01', vencimento: '2026-11-10', valor_centavos: 5000,
    }
    expect((await u.cliente.from('cobrancas').insert(linha)).error).toBeNull()
    expect((await u.cliente.from('cobrancas').insert(linha)).error?.code).toBe('23505')
  })
})
