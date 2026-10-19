import { describe, expect, it } from 'vitest'
import { criarUsuarioTeste } from './helpers'
import { criarLead } from '@/lib/servicos/leads'
import { criarProposta, salvarItens } from '@/lib/servicos/propostas'

async function itemDaProposta() {
  const { cliente } = await criarUsuarioTeste()
  const lead = await criarLead(cliente, {
    nomeContato: 'Maria',
    whatsapp: `(63) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
  })
  const propostaId = await criarProposta(cliente, lead.id)
  await salvarItens(cliente, propostaId, [
    { servicoId: null, descricao: 'Site', tipo: 'unico', valorCentavos: 1000, parcelas: 1, mesInicio: null, desconto: null },
  ])
  const { data: versao } = await cliente.from('versoes_proposta').select('id').eq('proposta_id', propostaId).single()
  const { data: item } = await cliente.from('itens_proposta').select('id').eq('versao_id', versao!.id).single()
  return { cliente, lead, propostaId, itemId: item!.id as string }
}

describe('reforços do banco', () => {
  it('banco recusa desconto em R$ que zera o item', async () => {
    const { cliente, itemId } = await itemDaProposta()
    const { error } = await cliente
      .from('itens_proposta')
      .update({ valor_centavos: 1000, desconto_tipo: 'valor', desconto_valor: 1000 })
      .eq('id', itemId)
    expect(error?.code).toBe('23514')
  })

  it('banco recusa percentual de 100%', async () => {
    const { cliente, itemId } = await itemDaProposta()
    const { error } = await cliente
      .from('itens_proposta')
      .update({ desconto_tipo: 'percentual', desconto_valor: 10000 })
      .eq('id', itemId)
    expect(error?.code).toBe('23514')
  })

  it('banco recusa link do MVP fora de http(s)', async () => {
    const { cliente, lead } = await itemDaProposta()
    const { error } = await cliente.from('leads').update({ link_mvp: 'javascript:alert(1)' }).eq('id', lead.id)
    expect(error?.code).toBe('23514')
  })

  it('updated_at da proposta muda sozinho', async () => {
    const { cliente, propostaId } = await itemDaProposta()
    const antes = await cliente.from('propostas').select('updated_at').eq('id', propostaId).single()
    await new Promise((r) => setTimeout(r, 20))
    const { error } = await cliente.from('propostas').update({ titulo: 'Novo título' }).eq('id', propostaId)
    expect(error).toBeNull()
    const depois = await cliente.from('propostas').select('updated_at').eq('id', propostaId).single()
    expect(new Date(depois.data!.updated_at).getTime()).toBeGreaterThan(new Date(antes.data!.updated_at).getTime())
  })
})
