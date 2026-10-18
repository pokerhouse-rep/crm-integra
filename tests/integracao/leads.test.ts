import { describe, expect, it } from 'vitest'
import { criarUsuarioTeste } from './helpers'
import { criarLead, listarLeads, obterLead, atualizarLead, adicionarAnotacao } from '@/lib/servicos/leads'
import { ErroNegocio } from '@/lib/servicos/tipos'

const dados = (whatsapp = '(63) 99999-0000', nome = 'Maria') => ({ nomeContato: nome, whatsapp })

describe('serviço de leads', () => {
  it('criarLead normaliza whatsapp e registra evento criado', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await criarLead(cliente, dados('+55 63 9 9999-0000'))
    expect(lead.whatsapp).toBe('5563999990000')
    expect(lead.etapa).toBe('prospect')
    const det = await obterLead(cliente, lead.id)
    expect(det.eventos.map((e) => e.tipo)).toEqual(['criado'])
  })

  it('criarLead rejeita whatsapp inválido', async () => {
    const { cliente } = await criarUsuarioTeste()
    await expect(criarLead(cliente, dados('123'))).rejects.toThrow('WhatsApp inválido. Use DDD + número.')
  })

  it('criarLead rejeita whatsapp duplicado com mensagem citando o lead existente', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarLead(cliente, dados('(63) 99999-0000', 'Maria'))
    const p = criarLead(cliente, dados('63999990000', 'Outra'))
    await expect(p).rejects.toBeInstanceOf(ErroNegocio)
    await expect(p).rejects.toThrow('Já existe um lead com este WhatsApp: Maria')
  })

  it('atualizarLead edita, atualiza updated_at e registra dados_editados', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await criarLead(cliente, dados())
    await new Promise((r) => setTimeout(r, 20))
    const novo = await atualizarLead(cliente, lead.id, { nomeContato: 'Mariana', empresa: 'Acme' })
    expect(novo.nome_contato).toBe('Mariana')
    expect(novo.empresa).toBe('Acme')
    expect(new Date(novo.updated_at).getTime()).toBeGreaterThan(new Date(lead.updated_at).getTime())
    const det = await obterLead(cliente, lead.id)
    expect(det.eventos.map((e) => e.tipo)).toContain('dados_editados')
  })

  it('adicionarAnotacao grava evento anotacao com texto', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await criarLead(cliente, dados())
    await adicionarAnotacao(cliente, lead.id, 'Ligar de manhã')
    const det = await obterLead(cliente, lead.id)
    expect(det.eventos[0].tipo).toBe('anotacao')
    expect(det.eventos[0].dados).toEqual({ texto: 'Ligar de manhã' })
  })

  it('listarLeads com busca por dígitos do telefone encontra o lead', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarLead(cliente, dados('(63) 99999-0000', 'Maria'))
    await criarLead(cliente, dados('(11) 98888-1111', 'João'))
    const achou = await listarLeads(cliente, { busca: '99999-00' })
    expect(achou.map((l) => l.nome_contato)).toEqual(['Maria'])
    const porNome = await listarLeads(cliente, { busca: 'joã' })
    expect(porNome.map((l) => l.nome_contato)).toEqual(['João'])
    expect(await listarLeads(cliente, { busca: '()' })).toEqual([])
    expect(await listarLeads(cliente, {})).toHaveLength(2)
    expect(await listarLeads(cliente, { etapa: 'fechado' })).toHaveLength(0)
  })
})
