import { describe, expect, it } from 'vitest'
import { criarUsuarioTeste } from './helpers'

describe('schema do núcleo', () => {
  it('novo usuário recebe configurações padrão', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { data, error } = await cliente
      .from('configuracoes')
      .select('sequencia_padrao, dias_reativacao')
    expect(error).toBeNull()
    expect(data).toEqual([{ sequencia_padrao: [2, 5, 10], dias_reativacao: 30 }])
  })

  it('novo usuário recebe 5 nichos, 5 origens, 6 motivos e 4 modelos', async () => {
    const { cliente } = await criarUsuarioTeste()
    const contar = async (tipo: string) => {
      const { data, error } = await cliente.from('opcoes').select('id').eq('tipo', tipo)
      expect(error).toBeNull()
      return data!.length
    }
    expect(await contar('nicho')).toBe(5)
    expect(await contar('origem')).toBe(5)
    expect(await contar('motivo_perda')).toBe(6)

    const { data: modelos, error } = await cliente
      .from('modelos_mensagem')
      .select('nome, texto, passo')
    expect(error).toBeNull()
    expect(modelos).toHaveLength(4)
    expect(modelos!.map((m) => m.passo).sort()).toEqual([1, 2, 3, null])
    const avulso = modelos!.find((m) => m.passo === null)!
    expect(avulso.nome).toBe('Primeiro contato')
    expect(avulso.texto).toContain('{nome}')
    expect(avulso.texto).toContain('{link_mvp}')
  })

  it('RLS isola usuários', async () => {
    const a = await criarUsuarioTeste()
    const b = await criarUsuarioTeste()
    const ins = await a.cliente
      .from('leads')
      .insert({ nome_contato: 'Fulano', whatsapp: '5563999990000' })
    expect(ins.error).toBeNull()

    const { data, error } = await b.cliente.from('leads').select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('whatsapp duplicado para o mesmo usuário é rejeitado', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = { nome_contato: 'Fulano', whatsapp: '5563999990001' }
    expect((await cliente.from('leads').insert(lead)).error).toBeNull()
    const segundo = await cliente.from('leads').insert(lead)
    expect(segundo.error?.code).toBe('23505')
  })
})
