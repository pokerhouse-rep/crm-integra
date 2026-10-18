import { describe, expect, it } from 'vitest'
import { criarUsuarioTeste } from './helpers'
import { atualizarLead, criarLead, listarLeads, obterLeadPorWhatsapp } from '@/lib/servicos/leads'
import { adicionarRetorno, cancelarRetorno } from '@/lib/servicos/retornos'
import { listarTarefasDoLead, criarTarefa } from '@/lib/servicos/tarefas'

describe('leitura da lista de leads', () => {
  it('listarLeads traz o próximo retorno pendente de cada lead (null sem retorno)', async () => {
    const { cliente } = await criarUsuarioTeste()
    const a = await criarLead(cliente, { nomeContato: 'A', whatsapp: '63999990001' })
    const b = await criarLead(cliente, { nomeContato: 'B', whatsapp: '63999990002' })
    await adicionarRetorno(cliente, a.id, '2030-05-20')
    await adicionarRetorno(cliente, a.id, '2030-05-10')
    await adicionarRetorno(cliente, b.id, '2030-04-01')
    const { data } = await cliente.from('retornos').select('id').eq('lead_id', b.id)
    await cancelarRetorno(cliente, data![0].id)

    const lista = await listarLeads(cliente, {})
    const porNome = Object.fromEntries(lista.map((l) => [l.nome_contato, l.proximo_retorno]))
    expect(porNome).toEqual({ A: '2030-05-10', B: null })
  })

  it('obterLeadPorWhatsapp aceita qualquer formato; atualizarLead grava linkMvp', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await criarLead(cliente, { nomeContato: 'A', whatsapp: '63999990001', linkMvp: 'https://x.com/a' })
    expect(lead.link_mvp).toBe('https://x.com/a')
    expect((await obterLeadPorWhatsapp(cliente, '+55 63 9 9999-0001'))?.id).toBe(lead.id)
    expect(await obterLeadPorWhatsapp(cliente, '(63) 98888-7777')).toBeNull()
    expect(await obterLeadPorWhatsapp(cliente, '12')).toBeNull()
    const novo = await atualizarLead(cliente, lead.id, { linkMvp: null })
    expect(novo.link_mvp).toBeNull()
  })

  it('listarTarefasDoLead traz só tarefas pendentes do lead, por data', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await criarLead(cliente, { nomeContato: 'A', whatsapp: '63999990001' })
    await criarTarefa(cliente, { titulo: 'depois', data: '2030-01-02', leadId: lead.id })
    await criarTarefa(cliente, { titulo: 'antes', data: '2030-01-01', leadId: lead.id })
    await criarTarefa(cliente, { titulo: 'sem lead', data: '2030-01-01' })
    const t = await listarTarefasDoLead(cliente, lead.id)
    expect(t.map((x) => x.titulo)).toEqual(['antes', 'depois'])
  })
})
