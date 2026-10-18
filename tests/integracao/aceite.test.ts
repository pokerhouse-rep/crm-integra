import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { criarClienteComContrato, criarUsuarioTeste } from './helpers'
import { criarLead, obterLead } from '@/lib/servicos/leads'
import { moverEtapa } from '@/lib/servicos/retornos'
import {
  aceitarProposta,
  criarProposta,
  enviarProposta,
  novaVersao,
  obterProposta,
  recusarProposta,
  salvarItens,
} from '@/lib/servicos/propostas'
import { chamarRpc } from '@/lib/servicos/rpc'
import type { ItemProposta } from '@/lib/dominio/propostas'

const site: ItemProposta = {
  servicoId: null, descricao: 'Site institucional', tipo: 'unico', valorCentavos: 150000, parcelas: 3, mesInicio: null, desconto: null,
}
const hospedagem: ItemProposta = {
  servicoId: null, descricao: 'Hospedagem', tipo: 'recorrente', valorCentavos: 15000, parcelas: 1, mesInicio: '2026-11-01', desconto: null,
}

let contador = 0
async function propostaEnviada(cliente: SupabaseClient, itens: ItemProposta[] = [site, hospedagem]) {
  contador += 1
  const lead = await criarLead(cliente, { nomeContato: 'Maria', whatsapp: `(63) 97777-${String(1000 + contador)}` })
  const id = await criarProposta(cliente, lead.id, 'Pacote')
  await salvarItens(cliente, id, itens)
  await enviarProposta(cliente, id, '2026-10-19')
  return { lead, id }
}

async function cobrancasDoContrato(cliente: SupabaseClient, contratoId: string) {
  const { data, error } = await cliente
    .from('cobrancas')
    .select('*, contrato_itens(ordem, descricao)')
    .eq('contrato_id', contratoId)
    .order('vencimento')
    .order('tipo')
  if (error) throw new Error(error.message)
  return data!
}

function argsRpc(propostaId: string, versaoId: string) {
  return {
    p_proposta_id: propostaId, p_versao_id: versaoId, p_descricao: 'X', p_dia_vencimento: 19, p_data_inicio: '2026-10-19',
    p_itens: [{ descricao: 'Site', tipo: 'unico', valor_centavos: 150000, parcelas: 1, mes_inicio: null }],
    p_cobrancas: [] as unknown[],
  }
}

const pendentes = (det: Awaited<ReturnType<typeof obterLead>>) => det.retornos.filter((r) => r.status === 'pendente')

describe('aceite da proposta', () => {
  it('critério 6: aceite com desconto na v2 gera contrato e cobranças previstas', async () => {
    const { cliente, userId } = await criarUsuarioTeste()
    const { lead, id } = await propostaEnviada(cliente)
    await novaVersao(cliente, id)
    await salvarItens(cliente, id, [{ ...site, desconto: { tipo: 'percentual', valor: 1000 } }, hospedagem])
    await enviarProposta(cliente, id, '2026-10-19')
    const contratoId = await aceitarProposta(cliente, id, { hoje: '2026-10-19' })

    const det = await obterLead(cliente, lead.id)
    expect(det.lead.etapa).toBe('fechado')
    expect(det.lead.cliente).toBe(true)
    expect(pendentes(det)).toEqual([])
    const evento = det.eventos.find((e) => e.tipo === 'proposta_aceita')
    expect(evento?.dados).toEqual({ proposta_id: id, versao: 2, contrato_id: contratoId })

    const prop = await obterProposta(cliente, id)
    expect(prop.proposta.status).toBe('aceita')
    expect(prop.proposta.aceita_em).toBe('2026-10-19')
    expect(prop.versoes).toHaveLength(2)

    const { data: contrato } = await cliente.from('contratos').select('*').eq('id', contratoId).single()
    expect(contrato).toMatchObject({
      lead_id: lead.id, proposta_id: id, descricao: 'Pacote', dia_vencimento: 19, data_inicio: '2026-10-19', status: 'ativo',
    })
    const { data: itens } = await cliente.from('contrato_itens').select('*').eq('contrato_id', contratoId).order('ordem')
    expect(itens!.map((i) => [i.descricao, i.tipo, Number(i.valor_centavos), i.parcelas, i.mes_inicio])).toEqual([
      ['Site institucional', 'unico', 135000, 3, null],
      ['Hospedagem', 'recorrente', 15000, 1, '2026-11-01'],
    ])

    const cobs = await cobrancasDoContrato(cliente, contratoId)
    expect(
      cobs.map((c) => [c.tipo, c.numero, c.total_parcelas, c.competencia, c.vencimento, Number(c.valor_centavos), c.status]),
    ).toEqual([
      ['parcela', 1, 3, null, '2026-10-19', 45000, 'aberta'],
      ['parcela', 2, 3, null, '2026-11-19', 45000, 'aberta'],
      ['mensalidade', null, null, '2026-11-01', '2026-11-19', 15000, 'aberta'],
      ['parcela', 3, 3, null, '2026-12-19', 45000, 'aberta'],
    ])
    for (const c of cobs) {
      expect(c.lead_id).toBe(lead.id)
      expect(c.user_id).toBe(userId)
      expect(c.contrato_itens.ordem).toBe(c.tipo === 'mensalidade' ? 1 : 0)
    }
  })

  it('aceitar duas vezes falha e cria um só contrato', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { lead, id } = await propostaEnviada(cliente)
    await aceitarProposta(cliente, id, { hoje: '2026-10-19' })
    await expect(aceitarProposta(cliente, id, { hoje: '2026-10-19' })).rejects.toThrow('Esta proposta já foi aceita.')
    const { data } = await cliente.from('contratos').select('id').eq('lead_id', lead.id)
    expect(data).toHaveLength(1)
  })

  it('duas chamadas simultâneas: exatamente uma resolve', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { lead, id } = await propostaEnviada(cliente)
    const r = await Promise.allSettled([
      aceitarProposta(cliente, id, { hoje: '2026-10-19' }),
      aceitarProposta(cliente, id, { hoje: '2026-10-19' }),
    ])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    const rejeitada = r.find((x) => x.status === 'rejected') as PromiseRejectedResult
    expect(rejeitada.reason.message).toBe('Esta proposta já foi aceita.')
    const { data: contratos } = await cliente.from('contratos').select('id').eq('lead_id', lead.id)
    expect(contratos).toHaveLength(1)
    const { data: cobs } = await cliente.from('cobrancas').select('id').eq('lead_id', lead.id)
    expect(cobs).toHaveLength(4)
  })

  it('aceitar proposta recusada falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaEnviada(cliente)
    await recusarProposta(cliente, id)
    await expect(aceitarProposta(cliente, id, { hoje: '2026-10-19' })).rejects.toThrow(
      'Proposta recusada: crie uma nova versão antes de aceitar.',
    )
  })

  it('dia de vencimento 29 é rejeitado', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaEnviada(cliente)
    await expect(aceitarProposta(cliente, id, { hoje: '2026-10-19', diaVencimento: 29 })).rejects.toThrow(
      'O dia de vencimento deve ser entre 1 e 28.',
    )
    await expect(aceitarProposta(cliente, id, { hoje: '2026-10-19', diaVencimento: 0 })).rejects.toThrow(
      'O dia de vencimento deve ser entre 1 e 28.',
    )
    expect((await obterProposta(cliente, id)).proposta.status).toBe('enviada')
  })

  it('aceite à vista com primeiro vencimento escolhido', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaEnviada(cliente, [{ ...site, valorCentavos: 90000, parcelas: 1 }])
    const contratoId = await aceitarProposta(cliente, id, { hoje: '2026-10-19', primeiroVencimento: '2026-10-25' })
    const cobs = await cobrancasDoContrato(cliente, contratoId)
    expect(cobs.map((c) => [c.tipo, c.vencimento, Number(c.valor_centavos)])).toEqual([['avista', '2026-10-25', 90000]])
  })

  it('aceite no dia 31 usa dia de vencimento 28', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaEnviada(cliente, [site])
    const contratoId = await aceitarProposta(cliente, id, { hoje: '2026-10-31' })
    const cobs = await cobrancasDoContrato(cliente, contratoId)
    expect(cobs.map((c) => c.vencimento)).toEqual(['2026-10-31', '2026-11-28', '2026-12-28'])
  })

  it('cliente existente: segundo contrato a partir de nova proposta', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { leadId, contratoId } = await criarClienteComContrato(cliente)
    const id = await criarProposta(cliente, leadId, 'Novo sistema')
    await salvarItens(cliente, id, [{ ...site, descricao: 'Sistema interno' }])
    await enviarProposta(cliente, id, '2026-10-20')
    const segundo = await aceitarProposta(cliente, id, { hoje: '2026-10-20' })
    expect(segundo).not.toBe(contratoId)
    const { data } = await cliente.from('contratos').select('id').eq('lead_id', leadId)
    expect(data).toHaveLength(2)
    const det = await obterLead(cliente, leadId)
    expect(det.lead.etapa).toBe('fechado')
    expect(pendentes(det)).toEqual([])
  })

  it('lead já fechado: aceite cancela só o retorno de proposta e não move etapa de novo', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await criarLead(cliente, { nomeContato: 'Joao', whatsapp: '(63) 96666-0001' })
    await moverEtapa(cliente, lead.id, 'fechado')
    const id = await criarProposta(cliente, lead.id)
    await salvarItens(cliente, id, [site])
    await enviarProposta(cliente, id, '2026-10-19')
    expect(pendentes(await obterLead(cliente, lead.id))).toHaveLength(1)
    await aceitarProposta(cliente, id, { hoje: '2026-10-19' })
    const det = await obterLead(cliente, lead.id)
    expect(pendentes(det)).toEqual([])
    expect(det.eventos.filter((e) => e.tipo === 'etapa_alterada' && e.dados?.para === 'fechado')).toHaveLength(1)
  })

  it('aceitar a partir de rascunho (sem enviar) é permitido', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await criarLead(cliente, { nomeContato: 'Ana', whatsapp: '(63) 96666-0002' })
    const id = await criarProposta(cliente, lead.id)
    await salvarItens(cliente, id, [site])
    await aceitarProposta(cliente, id, { hoje: '2026-10-19' })
    expect((await obterLead(cliente, lead.id)).lead.etapa).toBe('fechado')
  })

  it('proposta sem itens não pode ser aceita', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await criarLead(cliente, { nomeContato: 'Ana', whatsapp: '(63) 96666-0003' })
    const id = await criarProposta(cliente, lead.id)
    await expect(aceitarProposta(cliente, id, { hoje: '2026-10-19' })).rejects.toThrow('A proposta não tem itens.')
  })

  it('versão desatualizada: aceitar com o id da v1 depois de criar a v2 falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaEnviada(cliente)
    const v1 = (await obterProposta(cliente, id)).versoes[0].id
    await novaVersao(cliente, id)
    await expect(chamarRpc(cliente, 'aceitar_proposta', { ...argsRpc(id, v1) }, 'x')).rejects.toThrow(
      'A proposta mudou. Atualize a página e tente de novo.',
    )
    expect((await obterProposta(cliente, id)).proposta.status).toBe('rascunho')
  })

it('versaoEsperada de outra versão (aba antiga) é recusada sem criar contrato', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaEnviada(cliente)
    const v1 = (await obterProposta(cliente, id)).versoes[0].id
    await novaVersao(cliente, id)
    await expect(aceitarProposta(cliente, id, { hoje: '2026-10-19', versaoEsperada: v1 })).rejects.toThrow(
      'A proposta mudou. Atualize a página e tente de novo.',
    )
    expect((await obterProposta(cliente, id)).proposta.status).toBe('rascunho')
  })

  it('mesma versão em rascunho com itens alterados: a impressão digital diverge e recusa', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaEnviada(cliente)
    await novaVersao(cliente, id)
    const v = (await obterProposta(cliente, id)).versoes[0].id
    await salvarItens(cliente, id, [site, hospedagem])
    const mostrado = { itens: 2, unicoCentavos: 150000, recorrenteCentavos: 15000 }
    await salvarItens(cliente, id, [{ ...site, valorCentavos: 100000 }, hospedagem])
    await expect(
      aceitarProposta(cliente, id, { hoje: '2026-10-19', versaoEsperada: v, totaisEsperados: mostrado }),
    ).rejects.toThrow('A proposta mudou. Atualize a página e tente de novo.')
    await expect(
      aceitarProposta(cliente, id, {
        hoje: '2026-10-19',
        versaoEsperada: v,
        totaisEsperados: { itens: 2, unicoCentavos: 100000, recorrenteCentavos: 15000 },
      }),
    ).resolves.toBeTruthy()
  })

  it('quantidade de itens diferente da versão atual falha', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaEnviada(cliente)
    const v = (await obterProposta(cliente, id)).versoes[0].id
    await expect(chamarRpc(cliente, 'aceitar_proposta', { ...argsRpc(id, v) }, 'x')).rejects.toThrow(
      'A proposta mudou. Atualize a página e tente de novo.',
    )
  })

  it('descrição em branco e índice de cobrança fora do intervalo são rejeitados', async () => {
    const { cliente } = await criarUsuarioTeste()
    const { id } = await propostaEnviada(cliente, [site])
    const v = (await obterProposta(cliente, id)).versoes[0].id
    await expect(chamarRpc(cliente, 'aceitar_proposta', { ...argsRpc(id, v), p_descricao: '  ' }, 'x')).rejects.toThrow(
      'Informe a descrição do contrato.',
    )
    const cobranca = { item_indice: 5, tipo: 'avista', numero: null, total_parcelas: null, competencia: null, vencimento: '2026-10-19', valor_centavos: 150000 }
    await expect(
      chamarRpc(cliente, 'aceitar_proposta', { ...argsRpc(id, v), p_cobrancas: [cobranca] }, 'x'),
    ).rejects.toThrow('Dados do aceite inválidos.')
  })

  it('usuário não aceita proposta de outro', async () => {
    const a = await criarUsuarioTeste()
    const b = await criarUsuarioTeste()
    const { id } = await propostaEnviada(a.cliente)
    await expect(aceitarProposta(b.cliente, id, { hoje: '2026-10-19' })).rejects.toThrow('Proposta não encontrada.')
  })
})
