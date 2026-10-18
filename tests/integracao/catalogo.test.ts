import { describe, expect, it } from 'vitest'
import { criarUsuarioTeste } from './helpers'
import { listarServicos, salvarServico } from '@/lib/servicos/catalogo'
import { ErroNegocio } from '@/lib/servicos/tipos'

describe('catálogo de serviços', () => {
  it('salvarServico cria, edita e desativa', async () => {
    const { cliente } = await criarUsuarioTeste()
    const criado = await salvarServico(cliente, { nome: '  Landing page ', tipo: 'unico', precoCentavos: 90000, ativo: true })
    expect(criado.nome).toBe('Landing page')
    expect(criado.preco_centavos).toBe(90000)
    const editado = await salvarServico(cliente, { id: criado.id, nome: 'Landing page', tipo: 'unico', precoCentavos: 120000, ativo: true })
    expect(editado.preco_centavos).toBe(120000)
    const desativado = await salvarServico(cliente, { id: criado.id, nome: 'Landing page', tipo: 'unico', precoCentavos: 120000, ativo: false })
    expect(desativado.ativo).toBe(false)
  })

  it('listarServicos sem incluirInativos esconde o desativado', async () => {
    const { cliente } = await criarUsuarioTeste()
    const s = await salvarServico(cliente, { nome: 'Extra', tipo: 'recorrente', precoCentavos: 5000, ativo: false })
    expect((await listarServicos(cliente)).some((x) => x.id === s.id)).toBe(false)
    expect((await listarServicos(cliente, { incluirInativos: true })).some((x) => x.id === s.id)).toBe(true)
  })

  it('nome duplicado falha com "Já existe um serviço com esse nome."', async () => {
    const { cliente } = await criarUsuarioTeste()
    await salvarServico(cliente, { nome: 'Dup', tipo: 'unico', precoCentavos: 100, ativo: true })
    await expect(salvarServico(cliente, { nome: 'Dup', tipo: 'unico', precoCentavos: 100, ativo: true })).rejects.toThrow(
      'Já existe um serviço com esse nome.',
    )
  })

  it('nome vazio, preço negativo ou fracionado falham', async () => {
    const { cliente } = await criarUsuarioTeste()
    await expect(salvarServico(cliente, { nome: ' ', tipo: 'unico', precoCentavos: 100, ativo: true })).rejects.toThrow('Informe o nome do serviço.')
    await expect(salvarServico(cliente, { nome: 'Neg', tipo: 'unico', precoCentavos: -1, ativo: true })).rejects.toThrow('Informe um preço válido.')
    await expect(salvarServico(cliente, { nome: 'Frac', tipo: 'unico', precoCentavos: 1.5, ativo: true })).rejects.toBeInstanceOf(ErroNegocio)
  })
})
