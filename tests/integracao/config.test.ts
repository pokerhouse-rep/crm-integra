import { describe, expect, it } from 'vitest'
import { criarUsuarioTeste } from './helpers'
import { criarLead, obterLead } from '@/lib/servicos/leads'
import { marcarMvpEnviado } from '@/lib/servicos/retornos'
import {
  excluirModelo,
  listarModelos,
  listarOpcoes,
  listarTodasOpcoes,
  obterConfig,
  salvarConfig,
  salvarModelo,
  salvarOpcao,
} from '@/lib/servicos/config'
import { ErroNegocio } from '@/lib/servicos/tipos'

describe('configurações', () => {
  it('salvarConfig rejeita sequência vazia ou fora de ordem', async () => {
    const { cliente } = await criarUsuarioTeste()
    await expect(salvarConfig(cliente, { sequenciaPadrao: [] })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarConfig(cliente, { sequenciaPadrao: [5, 2] })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarConfig(cliente, { sequenciaPadrao: [2, 2] })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarConfig(cliente, { sequenciaPadrao: [0, 3] })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarConfig(cliente, { sequenciaPadrao: [1.5, 3] })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarConfig(cliente, { diasReativacao: 0 })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarConfig(cliente, { diasReativacao: 366 })).rejects.toBeInstanceOf(ErroNegocio)
    expect((await obterConfig(cliente)).sequenciaPadrao).toEqual([2, 5, 10])
  })

  it('salva sequência e dias válidos', async () => {
    const { cliente } = await criarUsuarioTeste()
    await salvarConfig(cliente, { sequenciaPadrao: [1, 4], diasReativacao: 45 })
    const c = await obterConfig(cliente)
    expect(c.sequenciaPadrao).toEqual([1, 4])
    expect(c.diasReativacao).toBe(45)
    expect(c.diasRetornoProposta).toBe(3)
  })

  it('nova sequência padrão é usada no próximo marcarMvpEnviado', async () => {
    const { cliente } = await criarUsuarioTeste()
    await salvarConfig(cliente, { sequenciaPadrao: [1, 3] })
    const lead = await criarLead(cliente, { nomeContato: 'Ana', whatsapp: '(63) 99999-0001' })
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    const { data } = await cliente.from('retornos').select('data_prevista').eq('lead_id', lead.id).order('data_prevista')
    expect((data ?? []).map((r) => r.data_prevista)).toEqual(['2026-10-20', '2026-10-22'])
  })

  it('opção desativada não aparece em listarOpcoes ativas mas o lead mantém a referência', async () => {
    const { cliente } = await criarUsuarioTeste()
    const todas = await listarTodasOpcoes(cliente, 'nicho')
    const clinica = todas.find((o) => o.nome === 'Clínica')!
    const lead = await criarLead(cliente, { nomeContato: 'Bia', whatsapp: '(63) 99999-0002', nichoId: clinica.id })
    await salvarOpcao(cliente, { id: clinica.id, tipo: 'nicho', nome: 'Clínica', ativo: false })
    expect((await listarOpcoes(cliente, 'nicho')).some((o) => o.id === clinica.id)).toBe(false)
    expect((await listarTodasOpcoes(cliente, 'nicho')).find((o) => o.id === clinica.id)?.ativo).toBe(false)
    expect((await obterLead(cliente, lead.id)).lead.nicho_id).toBe(clinica.id)
  })

  it('opções: nome vazio ou duplicado é rejeitado, nome é aparado, renomear e criar funcionam', async () => {
    const { cliente } = await criarUsuarioTeste()
    await expect(salvarOpcao(cliente, { tipo: 'origem', nome: '   ', ativo: true })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarOpcao(cliente, { tipo: 'origem', nome: 'Indicação', ativo: true })).rejects.toBeInstanceOf(ErroNegocio)
    const nova = await salvarOpcao(cliente, { tipo: 'origem', nome: '  Feira  ', ativo: true })
    expect(nova.nome).toBe('Feira')
    await salvarOpcao(cliente, { id: nova.id, tipo: 'origem', nome: 'Evento', ativo: true })
    const todas = await listarTodasOpcoes(cliente, 'origem')
    expect(todas.some((o) => o.nome === 'Evento')).toBe(true)
    expect(todas.some((o) => o.nome === 'Feira')).toBe(false)
    // mesmo nome em outro tipo é permitido
    await salvarOpcao(cliente, { tipo: 'nicho', nome: 'Evento', ativo: true })
  })

  it('modelos: salvar, editar, passo repetido rejeitado e excluir', async () => {
    const { cliente } = await criarUsuarioTeste()
    const padrao = await listarModelos(cliente)
    expect(padrao.length).toBe(4)
    const r1 = padrao.find((m) => m.passo === 1)!
    await salvarModelo(cliente, { id: r1.id, nome: 'Retorno 1', texto: 'Novo texto {nome}', passo: 1 })
    expect((await listarModelos(cliente)).find((m) => m.id === r1.id)?.texto).toBe('Novo texto {nome}')
    await expect(salvarModelo(cliente, { nome: 'Outro', texto: 'x', passo: 1 })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarModelo(cliente, { nome: 'Outro', texto: 'x', passo: 0 })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarModelo(cliente, { nome: ' ', texto: 'x', passo: null })).rejects.toBeInstanceOf(ErroNegocio)
    await expect(salvarModelo(cliente, { nome: 'Z', texto: ' ', passo: null })).rejects.toBeInstanceOf(ErroNegocio)
    const novo = await salvarModelo(cliente, { nome: 'Extra', texto: 'Oi {nome}', passo: 4 })
    await excluirModelo(cliente, novo.id)
    expect((await listarModelos(cliente)).some((m) => m.id === novo.id)).toBe(false)
  })
})
