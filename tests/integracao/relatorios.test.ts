import { describe, expect, it } from 'vitest'
import { criarClienteComContrato, criarUsuarioTeste } from './helpers'
import { hojeEmPalmas } from '@/lib/dominio/datas'
import { listarOpcoes } from '@/lib/servicos/config'
import { criarLead } from '@/lib/servicos/leads'
import { lerTodas } from '@/lib/servicos/paginacao'
import { relatorioConversao, relatorioFinanceiro, relatorioMotivos } from '@/lib/servicos/relatorios'
import { marcarMvpEnviado, moverEtapa } from '@/lib/servicos/retornos'

async function opcaoId(cliente: Parameters<typeof listarOpcoes>[0], tipo: 'nicho' | 'motivo_perda', nome: string) {
  const o = (await listarOpcoes(cliente, tipo)).find((x) => x.nome === nome)
  if (!o) throw new Error(`Opção ${nome} não encontrada`)
  return o.id
}

let seq = 0
const zap = () => `(63) 9${String(10000000 + ++seq * 7919 + Math.floor(Math.random() * 1000)).slice(0, 8)}`

describe('lerTodas', () => {
  it('junta páginas sem perder nem repetir linhas', async () => {
    const { cliente } = await criarUsuarioTeste()
    for (let i = 0; i < 5; i++) await criarLead(cliente, { nomeContato: `L${i}`, whatsapp: zap() })
    const linhas = await lerTodas<{ id: string }>(
      (de, ate) => cliente.from('leads').select('id').order('id').range(de, ate),
      'x',
      2,
    )
    expect(new Set(linhas.map((l) => l.id)).size).toBe(5)
    expect(linhas).toHaveLength(5)
  })
})

describe('relatorioConversao', () => {
  it('conta evento de 23:30 de Palmas no dia certo', async () => {
    const { cliente } = await criarUsuarioTeste()
    const nichoId = await opcaoId(cliente, 'nicho', 'Clínica')
    const lead = await criarLead(cliente, { nomeContato: 'A', whatsapp: zap(), nichoId })
    const { error } = await cliente
      .from('eventos')
      .insert({ lead_id: lead.id, tipo: 'mvp_enviado', dados: {}, ocorrido_em: '2026-11-01T02:30:00Z' })
    expect(error).toBeNull()
    const f = { nichoId: null, origemId: null }
    const out = await relatorioConversao(cliente, { chave: 'personalizado', de: '2026-10-01', ate: '2026-10-31' }, f)
    const nov = await relatorioConversao(cliente, { chave: 'personalizado', de: '2026-11-01', ate: '2026-11-30' }, f)
    expect(out.total.mvp).toBe(1)
    expect(nov.total.mvp).toBe(0)
  })

  it('filtra por nicho e agrupa por origem', async () => {
    const { cliente } = await criarUsuarioTeste()
    const clinica = await opcaoId(cliente, 'nicho', 'Clínica')
    const rest = await opcaoId(cliente, 'nicho', 'Restaurante')
    const hoje = hojeEmPalmas()
    const a = await criarLead(cliente, { nomeContato: 'A', whatsapp: zap(), nichoId: clinica })
    const b = await criarLead(cliente, { nomeContato: 'B', whatsapp: zap(), nichoId: rest })
    await marcarMvpEnviado(cliente, a.id, { hoje })
    await marcarMvpEnviado(cliente, b.id, { hoje })
    const periodo = { chave: 'personalizado' as const, de: hoje, ate: hoje }
    const filtrado = await relatorioConversao(cliente, periodo, { nichoId: clinica, origemId: null })
    expect(filtrado.total.mvp).toBe(1)
    const todos = await relatorioConversao(cliente, periodo, { nichoId: null, origemId: null })
    expect(todos.total.mvp).toBe(2)
    expect(todos.porNicho.map((g) => [g.nome, g.contagem.mvp])).toEqual([['Clínica', 1], ['Restaurante', 1]])
    expect(todos.porOrigem).toEqual([{ nome: 'Sem origem', contagem: expect.objectContaining({ mvp: 2 }) }])
  })
})

describe('relatorioFinanceiro', () => {
  it('financeiro do contrato de teste', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    const hoje = '2026-10-19'
    const out = await relatorioFinanceiro(cliente, { chave: 'personalizado', de: '2026-10-01', ate: '2026-10-31' }, hoje)
    expect(out.vendas).toMatchObject({ contratos: 1, unicoCentavos: 150000, mensalCentavos: 15000 })
    expect(out.recebimentos.previstoCentavos).toBe(50000)
    const set = await relatorioFinanceiro(cliente, { chave: 'personalizado', de: '2026-09-01', ate: '2026-09-30' }, hoje)
    expect(set.vendas.contratos).toBe(0)
  })
})

describe('relatorioMotivos', () => {
  it('só de quem continua perdido', async () => {
    const { cliente } = await criarUsuarioTeste()
    const motivo = await opcaoId(cliente, 'motivo_perda', 'Sem orçamento')
    const a = await criarLead(cliente, { nomeContato: 'A', whatsapp: zap() })
    const b = await criarLead(cliente, { nomeContato: 'B', whatsapp: zap() })
    await moverEtapa(cliente, a.id, 'perdido', motivo)
    await moverEtapa(cliente, b.id, 'perdido', motivo)
    await moverEtapa(cliente, b.id, 'em_conversa')
    const hoje = hojeEmPalmas()
    const out = await relatorioMotivos(cliente, { chave: 'personalizado', de: hoje, ate: hoje })
    expect(out).toEqual([{ nome: 'Sem orçamento', quantidade: 1, percentual: 100 }])
  })
})
