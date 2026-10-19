import { describe, expect, it } from 'vitest'
import { clienteAdmin, criarUsuarioTeste } from './helpers'
import { criarLead } from '@/lib/servicos/leads'
import { aceitarProposta, criarProposta, enviarProposta, propostasAguardando, salvarItens } from '@/lib/servicos/propostas'
import type { ItemProposta } from '@/lib/dominio/propostas'

const itens: ItemProposta[] = [
  { servicoId: null, descricao: 'Site', tipo: 'unico', valorCentavos: 150000, parcelas: 1, mesInicio: null, desconto: null },
  { servicoId: null, descricao: 'Hospedagem', tipo: 'recorrente', valorCentavos: 15000, parcelas: 1, mesInicio: '2026-11-01', desconto: null },
]

describe('propostasAguardando', () => {
  it('lista só propostas enviadas, com versão e dias', async () => {
    const { cliente } = await criarUsuarioTeste()
    const novo = async (nome: string) => {
      const lead = await criarLead(cliente, {
        nomeContato: nome,
        whatsapp: `(63) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      })
      const id = await criarProposta(cliente, lead.id)
      await salvarItens(cliente, id, itens)
      return { leadId: lead.id, id }
    }
    await novo('Rascunho')
    const enviada = await novo('Enviada')
    const aceita = await novo('Aceita')

    await enviarProposta(cliente, enviada.id, '2026-10-19')
    await enviarProposta(cliente, aceita.id, '2026-10-19')
    await aceitarProposta(cliente, aceita.id, { hoje: '2026-10-19' })
    const { error } = await clienteAdmin()
      .from('versoes_proposta')
      .update({ enviada_em: '2026-10-15T12:00:00Z' })
      .eq('proposta_id', enviada.id)
    expect(error).toBeNull()

    const lista = await propostasAguardando(cliente, '2026-10-19')
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({
      id: enviada.id,
      leadId: enviada.leadId,
      nomeLead: 'Enviada',
      versao: 1,
      unicoCentavos: 150000,
      recorrenteCentavos: 15000,
      enviadaEm: '2026-10-15',
      dias: 4,
    })
  })
})
