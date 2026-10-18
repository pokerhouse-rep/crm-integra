import { describe, expect, it } from 'vitest'
import { converterItem, converterItens, itemParaValores, type ValoresItem } from '@/lib/propostas-form'

const base: ValoresItem = {
  servicoId: '', descricao: 'Site', tipo: 'unico', valor: '1500', parcelas: '3',
  mesInicio: '2026-11', descontoTipo: '', desconto: '',
}

describe('converterItem', () => {
  it('converte valor único com parcelas', () => {
    const r = converterItem(base, 1)
    expect(r).toEqual({
      item: { servicoId: null, descricao: 'Site', tipo: 'unico', valorCentavos: 150000, parcelas: 3, mesInicio: null, desconto: null },
    })
  })

  it('aceita 1500.50 como R$ 1.500,50', () => {
    const r = converterItem({ ...base, valor: '1500.50' }, 1)
    expect('item' in r && r.item.valorCentavos).toBe(150050)
  })

  it('valor inválido devolve a mensagem do item', () => {
    expect(converterItem({ ...base, valor: '1,234' }, 2)).toEqual({ erro: 'Item 2: valor inválido.' })
    expect(converterItem({ ...base, valor: '-10' }, 1)).toEqual({ erro: 'Item 1: valor inválido.' })
    expect(converterItem({ ...base, valor: 'abc' }, 1)).toEqual({ erro: 'Item 1: valor inválido.' })
  })

  it('desconto percentual em centésimos e em reais', () => {
    const p = converterItem({ ...base, descontoTipo: 'percentual', desconto: '7,5' }, 1)
    expect('item' in p && p.item.desconto).toEqual({ tipo: 'percentual', valor: 750 })
    const v = converterItem({ ...base, descontoTipo: 'valor', desconto: '50' }, 1)
    expect('item' in v && v.item.desconto).toEqual({ tipo: 'valor', valor: 5000 })
    expect(converterItem({ ...base, descontoTipo: 'percentual', desconto: 'x' }, 3)).toEqual({ erro: 'Item 3: valor inválido.' })
    expect(converterItem({ ...base, descontoTipo: 'valor', desconto: '' }, 1)).toEqual({ erro: 'Item 1: valor inválido.' })
  })

  it('parcelas inválidas são rejeitadas', () => {
    expect(converterItem({ ...base, parcelas: '' }, 1)).toEqual({ erro: 'Item 1: número de parcelas inválido.' })
    expect(converterItem({ ...base, parcelas: '2,5' }, 1)).toEqual({ erro: 'Item 1: número de parcelas inválido.' })
  })

  it('mensal usa o mês de início e ignora parcelas', () => {
    const r = converterItem({ ...base, tipo: 'recorrente', parcelas: 'lixo' }, 1)
    expect('item' in r && r.item).toMatchObject({ tipo: 'recorrente', parcelas: 1, mesInicio: '2026-11-01' })
  })

  it('formato do mês: vazio vira nulo, inválido é rejeitado', () => {
    const vazio = converterItem({ ...base, tipo: 'recorrente', mesInicio: '' }, 1)
    expect('item' in vazio && vazio.item.mesInicio).toBeNull()
    expect(converterItem({ ...base, tipo: 'recorrente', mesInicio: '2026-13' }, 4)).toEqual({ erro: 'Item 4: mês de início inválido.' })
    expect(converterItem({ ...base, tipo: 'recorrente', mesInicio: '11/2026' }, 1)).toEqual({ erro: 'Item 1: mês de início inválido.' })
  })

  it('tipo desconhecido é rejeitado', () => {
    expect(converterItem({ ...base, tipo: 'x' }, 1)).toEqual({ erro: 'Item 1: tipo inválido.' })
  })
})

describe('converterItens', () => {
  it('para no primeiro item inválido com o número certo', () => {
    expect(converterItens([base, { ...base, valor: 'zzz' }])).toEqual({ erro: 'Item 2: valor inválido.' })
  })

  it('converte a lista toda', () => {
    const r = converterItens([base, { ...base, tipo: 'recorrente', valor: '150' }])
    expect('itens' in r && r.itens).toHaveLength(2)
  })
})

describe('itemParaValores', () => {
  it('ida e volta com desconto percentual e em reais', () => {
    for (const desconto of [{ tipo: 'percentual' as const, valor: 750 }, { tipo: 'valor' as const, valor: 5000 }, null]) {
      const item = { servicoId: null, descricao: 'Site', tipo: 'unico' as const, valorCentavos: 150050, parcelas: 3, mesInicio: null, desconto }
      const r = converterItem(itemParaValores(item), 1)
      expect(r).toEqual({ item })
    }
  })
})
