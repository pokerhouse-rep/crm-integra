import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { criarUsuarioTeste } from './helpers'
import { criarLead, obterLead } from '@/lib/servicos/leads'
import { marcarMvpEnviado, moverEtapa } from '@/lib/servicos/retornos'
import { salvarConfig } from '@/lib/servicos/config'
import {
  criarProposta,
  enviarProposta,
  listarPropostasDoLead,
  novaVersao,
  obterProposta,
  recusarProposta,
  salvarItens,
  valoresAbertosPorLead,
} from '@/lib/servicos/propostas'
import type { ItemProposta } from '@/lib/dominio/propostas'

const itemSite: ItemProposta = {
  servicoId: null,
  descricao: 'Site institucional',
  tipo: 'unico',
  valorCentavos: 150000,
  parcelas: 3,
  mesInicio: null,
  desconto: null,
}
const itemHospedagem: ItemProposta = {
  servicoId: null,
  descricao: 'Hospedagem',
  tipo: 'recorrente',
  valorCentavos: 15000,
  parcelas: 1,
  mesInicio: '2026-11-01',
  desconto: null,
}

let contador = 0
async function novoLead(cliente: SupabaseClient) {
  contador += 1
  return criarLead(cliente, { nomeContato: 'Maria', whatsapp: `(63) 98888-${String(1000 + contador)}` })
}
async function propostaComItens(cliente: SupabaseClient, itens = [itemSite, itemHospedagem]) {
  const lead = await novoLead(cliente)
  const id = await criarProposta(cliente, lead.id)
  await salvarItens(cliente, id, itens)
  return { lead, id }
}
const pendentes = (det: Awaited<ReturnType<typeof obterLead>>, origem?: string) =>
  det.retornos
    .filter((r) => r.status === 'pendente' && (!origem || r.origem === origem))
    .map((r) => r.data_prevista)
    .sort()

describe('serviço de propostas', () => {
  it('criarProposta cria versão 1 em rascunho e registra evento', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    const id = await criarProposta(cliente, lead.id, 'Site + hospedagem')
    const det = await obterProposta(cliente, id)
    expect(det.proposta.titulo).toBe('Site + hospedagem')
    expect(det.proposta.status).toBe('rascunho')
    expect(det.lead.id).toBe(lead.id)
    expect(det.versoes).toHaveLength(1)
    expect(det.versoes[0]).toMatchObject({ numero: 1, itens: [], enviada_em: null })
    const eventos = (await obterLead(cliente, lead.id)).eventos
    expect(eventos.find((e) => e.tipo === 'proposta_criada')?.dados).toEqual({ proposta_id: id })
  })

  it('criarProposta com lead inexistente falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    await expect(criarProposta(cliente, '00000000-0000-4000-8000-000000000000')).rejects.toThrow('Lead não encontrado.')
  })

  it('salvarItens grava itens e totais da versão', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaComItens(cliente, [
      { ...itemSite, desconto: { tipo: 'valor', valor: 30000 } },
      itemHospedagem,
    ])
    const det = await obterProposta(cliente, id)
    const v = det.versoes[0]
    expect(v.total_unico_centavos).toBe(120000)
    expect(v.total_recorrente_centavos).toBe(15000)
    expect(v.itens).toEqual([
      { ...itemSite, desconto: { tipo: 'valor', valor: 30000 } },
      itemHospedagem,
    ])
    // salvar de novo substitui os itens
    await salvarItens(cliente, id, [itemHospedagem])
    const depois = (await obterProposta(cliente, id)).versoes[0]
    expect(depois.itens).toEqual([itemHospedagem])
    expect(depois.total_unico_centavos).toBe(0)
    expect(depois.total_recorrente_centavos).toBe(15000)
  })

  it('salvarItens normaliza parcelas e mês de início conforme o tipo', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    const id = await criarProposta(cliente, lead.id)
    await salvarItens(cliente, id, [
      { ...itemSite, mesInicio: '2026-11-01' },
      { ...itemHospedagem, parcelas: 6 },
    ])
    const itens = (await obterProposta(cliente, id)).versoes[0].itens
    expect(itens[0]).toMatchObject({ parcelas: 3, mesInicio: null })
    expect(itens[1]).toMatchObject({ parcelas: 1, mesInicio: '2026-11-01' })
  })

  it('salvarItens com item inválido falha citando o número do item', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    const id = await criarProposta(cliente, lead.id)
    await expect(salvarItens(cliente, id, [itemSite, { ...itemHospedagem, descricao: '  ' }])).rejects.toThrow(
      'Item 2: Informe a descrição do item.',
    )
  })

  it('salvarItens rejeita valor líquido menor que o número de parcelas', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    const id = await criarProposta(cliente, lead.id)
    await expect(
      salvarItens(cliente, id, [itemSite, { ...itemSite, valorCentavos: 2, parcelas: 3 }]),
    ).rejects.toThrow('Item 2: O valor é baixo demais para esse número de parcelas.')
    await expect(
      salvarItens(cliente, id, [{ ...itemSite, valorCentavos: 10000, parcelas: 10, desconto: { tipo: 'valor', valor: 9995 } }]),
    ).rejects.toThrow('Item 1: O valor é baixo demais para esse número de parcelas.')
  })

  it('salvarItens rejeita desconto não inteiro', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    const id = await criarProposta(cliente, lead.id)
    await expect(
      salvarItens(cliente, id, [{ ...itemSite, desconto: { tipo: 'percentual', valor: 10.5 } }]),
    ).rejects.toThrow('Item 1: Desconto inválido.')
    await expect(
      salvarItens(cliente, id, [itemSite, { ...itemHospedagem, desconto: { tipo: 'valor', valor: 99.5 } }]),
    ).rejects.toThrow('Item 2: Desconto inválido.')
  })

  it('enviar v1 em 19/10 move o lead para proposta_enviada e cria retorno de proposta em 22/10', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { lead, id } = await propostaComItens(cliente)
    await enviarProposta(cliente, id, '2026-10-19')
    const det = await obterLead(cliente, lead.id)
    expect(det.lead.etapa).toBe('proposta_enviada')
    expect(pendentes(det, 'proposta')).toEqual(['2026-10-22'])
    expect(det.retornos.find((r) => r.origem === 'proposta')).toMatchObject({ ciclo: 1, status: 'pendente' })
    const evento = det.eventos.find((e) => e.tipo === 'proposta_enviada')
    expect(evento?.dados).toEqual({ proposta_id: id, versao: 1, total_unico: 150000, total_recorrente: 15000 })
    const prop = await obterProposta(cliente, id)
    expect(prop.proposta.status).toBe('enviada')
    expect(prop.versoes[0].enviada_em).not.toBeNull()
  })

  it('enviar cancela retornos de sequência pendentes', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    expect(pendentes(await obterLead(cliente, lead.id), 'sequencia')).toHaveLength(3)
    const id = await criarProposta(cliente, lead.id)
    await salvarItens(cliente, id, [itemSite])
    await enviarProposta(cliente, id, '2026-10-20')
    const det = await obterLead(cliente, lead.id)
    expect(pendentes(det, 'sequencia')).toEqual([])
    expect(pendentes(det)).toEqual(['2026-10-23'])
  })

  it('enviar proposta sem itens falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    const id = await criarProposta(cliente, lead.id)
    await expect(enviarProposta(cliente, id, '2026-10-19')).rejects.toThrow('Adicione ao menos um item antes de enviar.')
    expect((await obterProposta(cliente, id)).proposta.status).toBe('rascunho')
    expect((await obterLead(cliente, lead.id)).lead.etapa).toBe('prospect')
  })

  it('enviar duas vezes falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaComItens(cliente)
    await enviarProposta(cliente, id, '2026-10-19')
    await expect(enviarProposta(cliente, id, '2026-10-19')).rejects.toThrow('Esta versão já foi enviada.')
  })

  it('salvarItens em proposta enviada falha com "Crie uma nova versão"', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaComItens(cliente)
    await enviarProposta(cliente, id, '2026-10-19')
    await expect(salvarItens(cliente, id, [itemSite])).rejects.toThrow(
      'Esta versão já foi enviada. Crie uma nova versão para alterar.',
    )
  })

  it('salvarItens em proposta recusada falha com mensagem própria', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaComItens(cliente)
    await enviarProposta(cliente, id, '2026-10-19')
    await recusarProposta(cliente, id)
    await expect(salvarItens(cliente, id, [itemSite])).rejects.toThrow(
      'Proposta recusada. Crie uma nova versão para alterar.',
    )
  })

  it('nova versão de rascunho falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaComItens(cliente)
    await expect(novaVersao(cliente, id)).rejects.toThrow('A versão atual ainda é um rascunho.')
  })

  it('nova versão copia os itens; enviar v2 move para negociacao e deixa um só retorno de proposta pendente', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { lead, id } = await propostaComItens(cliente)
    await enviarProposta(cliente, id, '2026-10-19')
    expect(await novaVersao(cliente, id)).toBe(2)

    const meio = await obterProposta(cliente, id)
    expect(meio.proposta.status).toBe('rascunho')
    expect(meio.versoes.map((v) => v.numero)).toEqual([2, 1])
    expect(meio.versoes[0].itens).toEqual([itemSite, itemHospedagem])
    expect(meio.versoes[0].total_unico_centavos).toBe(150000)
    expect(meio.versoes[0].enviada_em).toBeNull()
    expect(meio.versoes[1].itens).toHaveLength(2)

    await salvarItens(cliente, id, [{ ...itemSite, valorCentavos: 120000 }])
    // a versão 1 continua intacta
    const v1 = (await obterProposta(cliente, id)).versoes.find((v) => v.numero === 1)!
    expect(v1.itens).toEqual([itemSite, itemHospedagem])

    await enviarProposta(cliente, id, '2026-10-22')
    const det = await obterLead(cliente, lead.id)
    expect(det.lead.etapa).toBe('negociacao')
    expect(pendentes(det, 'proposta')).toEqual(['2026-10-26'])
    expect(det.retornos.filter((r) => r.origem === 'proposta' && r.status === 'cancelado')).toHaveLength(1)
    const tipos = det.eventos.map((e) => e.tipo)
    expect(tipos).toContain('proposta_nova_versao')
    expect(det.eventos.filter((e) => e.tipo === 'proposta_enviada')).toHaveLength(2)
  })

  it('proposta para cliente existente não muda a etapa fechado', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await moverEtapa(cliente, lead.id, 'fechado')
    const id = await criarProposta(cliente, lead.id)
    await salvarItens(cliente, id, [itemSite])
    await enviarProposta(cliente, id, '2026-10-19')
    const det = await obterLead(cliente, lead.id)
    expect(det.lead.etapa).toBe('fechado')
    expect(det.lead.cliente).toBe(true)
    expect(pendentes(det, 'proposta')).toEqual(['2026-10-22'])
  })

  it('dias de retorno de proposta configurados são usados', async () => {
    const { cliente } = await criarUsuarioTeste()
    await salvarConfig(cliente, { diasRetornoProposta: 5 })
    const { lead, id } = await propostaComItens(cliente)
    await enviarProposta(cliente, id, '2026-10-19')
    // 19/10 + 5 = 24/10 (sábado) -> 26/10
    expect(pendentes(await obterLead(cliente, lead.id), 'proposta')).toEqual(['2026-10-26'])
  })

  it('recusar mantém a etapa e cancela o retorno de proposta', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { lead, id } = await propostaComItens(cliente)
    await enviarProposta(cliente, id, '2026-10-19')
    await recusarProposta(cliente, id)
    const det = await obterLead(cliente, lead.id)
    expect(det.lead.etapa).toBe('proposta_enviada')
    expect(pendentes(det)).toEqual([])
    expect(det.eventos.map((e) => e.tipo)).toContain('proposta_recusada')
    expect((await obterProposta(cliente, id)).proposta.status).toBe('recusada')
    await expect(recusarProposta(cliente, id)).rejects.toThrow('Esta proposta já foi recusada.')
    // proposta recusada pode ganhar nova versão
    expect(await novaVersao(cliente, id)).toBe(2)
  })

  it('toda escrita em propostas atualiza updated_at', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    const id = await criarProposta(cliente, lead.id)
    const ler = async () => (await obterProposta(cliente, id)).proposta.updated_at
    let anterior = await ler()
    const passos: (() => Promise<unknown>)[] = [
      () => salvarItens(cliente, id, [itemSite]),
      () => enviarProposta(cliente, id, '2026-10-19'),
      () => novaVersao(cliente, id),
      () => salvarItens(cliente, id, [itemSite, itemHospedagem]),
      () => enviarProposta(cliente, id, '2026-10-20'),
      () => recusarProposta(cliente, id),
    ]
    for (const passo of passos) {
      await new Promise((r) => setTimeout(r, 15))
      await passo()
      const atual = await ler()
      expect(new Date(atual).getTime()).toBeGreaterThan(new Date(anterior).getTime())
      anterior = atual
    }
  })

  it('obterProposta de id inexistente falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    await expect(obterProposta(cliente, '00000000-0000-4000-8000-000000000000')).rejects.toThrow(
      'Proposta não encontrada.',
    )
  })

  it('usuário não enxerga nem altera proposta de outro', async () => {
    const a = await criarUsuarioTeste()
    const b = await criarUsuarioTeste()
    const { id } = await propostaComItens(a.cliente)
    await expect(obterProposta(b.cliente, id)).rejects.toThrow('Proposta não encontrada.')
    await expect(enviarProposta(b.cliente, id, '2026-10-19')).rejects.toThrow('Proposta não encontrada.')
  })

  it('listarPropostasDoLead traz versão atual e totais, mais recentes primeiro', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    const p1 = await criarProposta(cliente, lead.id, 'Primeira')
    await salvarItens(cliente, p1, [itemSite])
    await enviarProposta(cliente, p1, '2026-10-19')
    await novaVersao(cliente, p1)
    await salvarItens(cliente, p1, [itemSite, itemHospedagem])
    await new Promise((r) => setTimeout(r, 15))
    const p2 = await criarProposta(cliente, lead.id, 'Segunda')
    const lista = await listarPropostasDoLead(cliente, lead.id)
    expect(lista.map((p) => p.titulo)).toEqual(['Segunda', 'Primeira'])
    expect(lista[0]).toMatchObject({ id: p2, versaoAtual: 1, totalUnicoCentavos: 0, totalRecorrenteCentavos: 0 })
    expect(lista[1]).toMatchObject({ id: p1, versaoAtual: 2, totalUnicoCentavos: 150000, totalRecorrenteCentavos: 15000 })
  })

  it('valoresAbertosPorLead usa a última versão e ignora recusadas e leads perdidos', async () => {
    const { cliente } = await criarUsuarioTeste()
    // lead A: v1 enviada (150000 + 15000/mês), v2 rascunho com valor menor -> conta a v2
    const a = await propostaComItens(cliente)
    await enviarProposta(cliente, a.id, '2026-10-19')
    await novaVersao(cliente, a.id)
    await salvarItens(cliente, a.id, [{ ...itemSite, valorCentavos: 100000 }])
    // lead A: segunda proposta em rascunho soma
    const a2 = await criarProposta(cliente, a.lead.id)
    await salvarItens(cliente, a2, [itemHospedagem])
    // lead B: recusada
    const b = await propostaComItens(cliente)
    await enviarProposta(cliente, b.id, '2026-10-19')
    await recusarProposta(cliente, b.id)
    // lead C: perdido
    const c = await propostaComItens(cliente)
    await enviarProposta(cliente, c.id, '2026-10-19')
    const { data: motivo } = await cliente.from('opcoes').select('id').eq('tipo', 'motivo_perda').limit(1).single()
    await moverEtapa(cliente, c.lead.id, 'perdido', motivo!.id as string)

    const valores = await valoresAbertosPorLead(cliente)
    expect(valores).toEqual({ [a.lead.id]: { unicoCentavos: 100000, recorrenteCentavos: 15000 } })
  })
})
