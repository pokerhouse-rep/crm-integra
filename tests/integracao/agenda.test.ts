import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { criarUsuarioTeste } from './helpers'
import { criarLead, obterLead } from '@/lib/servicos/leads'
import { agendaDaSemana, agendaDoDia } from '@/lib/servicos/agenda'
import { concluirTarefa, criarTarefa, excluirTarefa, reagendarTarefa } from '@/lib/servicos/tarefas'

async function novoLead(cliente: SupabaseClient, whatsapp = '(63) 99999-0000') {
  return criarLead(cliente, { nomeContato: 'Maria', whatsapp })
}

async function inserirRetorno(
  cliente: SupabaseClient,
  leadId: string,
  data: string,
  extra: Record<string, unknown> = {},
) {
  const { data: r, error } = await cliente
    .from('retornos')
    .insert({ lead_id: leadId, data_prevista: data, origem: 'sequencia', ...extra })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return r as { id: string }
}

describe('agenda', () => {
  it('agendaDoDia separa atrasados e de hoje', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await inserirRetorno(cliente, lead.id, '2026-10-16')
    await criarTarefa(cliente, { titulo: 'Ligar', data: '2026-10-19' })
    await criarTarefa(cliente, { titulo: 'Futura', data: '2026-10-20' })
    const ag = await agendaDoDia(cliente, '2026-10-19')
    expect(ag.atrasados).toHaveLength(1)
    expect(ag.atrasados[0].tipo).toBe('retorno')
    expect(ag.hoje).toHaveLength(1)
    expect(ag.hoje[0].tipo).toBe('tarefa')
  })

  it('retornos feitos e cancelados e tarefas feitas não aparecem', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await inserirRetorno(cliente, lead.id, '2026-10-19', { status: 'feito' })
    await inserirRetorno(cliente, lead.id, '2026-10-19', { status: 'cancelado' })
    const t = await criarTarefa(cliente, { titulo: 'X', data: '2026-10-18' })
    await concluirTarefa(cliente, t.id)
    const ag = await agendaDoDia(cliente, '2026-10-19')
    expect(ag.atrasados).toHaveLength(0)
    expect(ag.hoje).toHaveLength(0)
  })

  it('item de retorno traz passo 2 de 3 e o modelo de passo 2', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await inserirRetorno(cliente, lead.id, '2026-10-17', { status: 'feito' })
    await inserirRetorno(cliente, lead.id, '2026-10-19')
    await inserirRetorno(cliente, lead.id, '2026-10-24')
    const ag = await agendaDoDia(cliente, '2026-10-19')
    const item = ag.hoje[0]
    if (item.tipo !== 'retorno') throw new Error('esperava retorno')
    expect(item.passo).toBe(2)
    expect(item.totalPassos).toBe(3)
    expect(item.modelo?.passo).toBe(2)
    expect(item.lead.id).toBe(lead.id)
  })

  it('passo além dos modelos usa o de maior passo existente', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    for (const d of ['2026-10-10', '2026-10-11', '2026-10-12']) {
      await inserirRetorno(cliente, lead.id, d, { status: 'feito' })
    }
    await inserirRetorno(cliente, lead.id, '2026-10-19')
    const ag = await agendaDoDia(cliente, '2026-10-19')
    const item = ag.hoje[0]
    if (item.tipo !== 'retorno') throw new Error('esperava retorno')
    expect(item.passo).toBe(4)
    expect(item.totalPassos).toBe(4)
    expect(item.modelo?.passo).toBe(3)
  })

  it('passo conta só o mesmo ciclo e ignora retornos adiados', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await inserirRetorno(cliente, lead.id, '2026-09-01', { status: 'feito', ciclo: 1 })
    await inserirRetorno(cliente, lead.id, '2026-09-05', { status: 'feito', ciclo: 1 })
    await inserirRetorno(cliente, lead.id, '2026-10-15', { origem: 'adiado', status: 'feito', ciclo: 2 })
    await inserirRetorno(cliente, lead.id, '2026-10-19', { origem: 'reativacao', ciclo: 2 })
    const ag = await agendaDoDia(cliente, '2026-10-19')
    const item = ag.hoje[0]
    if (item.tipo !== 'retorno') throw new Error('esperava retorno')
    expect(item.passo).toBe(1)
    expect(item.totalPassos).toBe(1)
    expect(item.modelo?.passo).toBe(1)
  })

  it('retorno adiado tem passo 0 e o modelo avulso', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await inserirRetorno(cliente, lead.id, '2026-10-19', { origem: 'adiado' })
    await inserirRetorno(cliente, lead.id, '2026-10-20')
    const ag = await agendaDoDia(cliente, '2026-10-19')
    const item = ag.hoje[0]
    if (item.tipo !== 'retorno') throw new Error('esperava retorno')
    expect(item.retorno.origem).toBe('adiado')
    expect(item.passo).toBe(0)
    expect(item.totalPassos).toBe(0)
    expect(item.modelo?.passo).toBeNull()
    expect(item.modelo?.nome).toBe('Primeiro contato')
  })

  it('agendaDaSemana agrupa por dia', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await inserirRetorno(cliente, lead.id, '2026-10-19')
    await criarTarefa(cliente, { titulo: 'A', data: '2026-10-19' })
    await criarTarefa(cliente, { titulo: 'B', data: '2026-10-22' })
    await criarTarefa(cliente, { titulo: 'fora', data: '2026-10-26' })
    await criarTarefa(cliente, { titulo: 'antes', data: '2026-10-18' })
    const sem = await agendaDaSemana(cliente, '2026-10-19')
    expect(Object.keys(sem)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(sem['2026-10-19']).toHaveLength(2)
    expect(sem['2026-10-20']).toHaveLength(0)
    expect(sem['2026-10-22']).toHaveLength(1)
  })
})

describe('tarefas', () => {
  it('concluirTarefa com lead registra evento tarefa_concluida uma única vez', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    const t = await criarTarefa(cliente, { titulo: 'Enviar proposta', data: '2026-10-19', leadId: lead.id })
    await concluirTarefa(cliente, t.id)
    await concluirTarefa(cliente, t.id)
    const det = await obterLead(cliente, lead.id)
    expect(det.eventos.filter((e) => e.tipo === 'tarefa_concluida')).toHaveLength(1)
  })

  it('concluirTarefa sem lead não gera evento e reagendar/excluir funcionam', async () => {
    const { cliente } = await criarUsuarioTeste()
    const t = await criarTarefa(cliente, { titulo: 'Solta', data: '2026-10-19', hora: '09:00' })
    await reagendarTarefa(cliente, t.id, '2026-10-21', '10:30')
    const { data } = await cliente.from('tarefas').select('*').eq('id', t.id).single()
    expect(data!.data).toBe('2026-10-21')
    expect(data!.hora).toBe('10:30:00')
    await concluirTarefa(cliente, t.id)
    await excluirTarefa(cliente, t.id)
    const { data: depois } = await cliente.from('tarefas').select('id').eq('id', t.id)
    expect(depois).toHaveLength(0)
  })

  it('título vazio é rejeitado', async () => {
    const { cliente } = await criarUsuarioTeste()
    await expect(criarTarefa(cliente, { titulo: '  ', data: '2026-10-19' })).rejects.toThrow(/título/)
  })
})
