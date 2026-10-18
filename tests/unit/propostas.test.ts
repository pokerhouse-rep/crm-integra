import { describe, it, expect } from 'vitest'
import { descontoDoItem, valorLiquido, totaisProposta, dividirParcelas, validarItem, type ItemProposta } from '@/lib/dominio/propostas'

function item(parcial: Partial<ItemProposta> = {}): ItemProposta {
  return { servicoId: null, descricao: 'Site', tipo: 'unico', valorCentavos: 150000, parcelas: 1, mesInicio: null, desconto: null, ...parcial }
}

describe('propostas', () => {
  it('desconto percentual arredonda ao centavo', () => {
    expect(descontoDoItem(item({ desconto: { tipo: 'percentual', valor: 1000 } }))).toBe(15000)
    expect(descontoDoItem(item({ valorCentavos: 9999, desconto: { tipo: 'percentual', valor: 333 } }))).toBe(333)
    expect(descontoDoItem(item())).toBe(0)
  })

  it('desconto em reais', () => {
    const i = item({ desconto: { tipo: 'valor', valor: 20000 } })
    expect(descontoDoItem(i)).toBe(20000)
    expect(valorLiquido(i)).toBe(130000)
  })

  it('totais separam único e recorrente com desconto', () => {
    const itens = [
      item({ parcelas: 3, desconto: { tipo: 'percentual', valor: 1000 } }),
      item({ descricao: 'Hospedagem', tipo: 'recorrente', valorCentavos: 15000, mesInicio: '2026-11-01' }),
    ]
    expect(totaisProposta(itens)).toEqual({ unicoCentavos: 135000, recorrenteCentavos: 15000, descontoCentavos: 15000 })
  })

  it('parcelas somam o total', () => {
    expect(dividirParcelas(100000, 3)).toEqual([33334, 33333, 33333])
    expect(dividirParcelas(150000, 3)).toEqual([50000, 50000, 50000])
    for (let n = 1; n <= 48; n++) {
      for (const total of [1, 99, 100000, 145501]) {
        if (total < n) continue
        const p = dividirParcelas(total, n)
        expect(p).toHaveLength(n)
        expect(p.reduce((a, b) => a + b, 0)).toBe(total)
        expect(Math.min(...p)).toBeGreaterThan(0)
      }
    }
  })

  it('valida item', () => {
    expect(validarItem(item())).toBeNull()
    expect(validarItem(item({ descricao: '   ' }))).toBe('Informe a descrição do item.')
    expect(validarItem(item({ valorCentavos: 0 }))).toBe('O valor do item deve ser maior que zero.')
    expect(validarItem(item({ valorCentavos: 10.5 }))).toBe('O valor do item deve ser maior que zero.')
    expect(validarItem(item({ parcelas: 0 }))).toBe('O número de parcelas deve ser de 1 a 48.')
    expect(validarItem(item({ parcelas: 49 }))).toBe('O número de parcelas deve ser de 1 a 48.')
    expect(validarItem(item({ parcelas: 2.5 }))).toBe('O número de parcelas deve ser de 1 a 48.')
    expect(validarItem(item({ parcelas: 48 }))).toBeNull()
    expect(validarItem(item({ tipo: 'recorrente', mesInicio: null }))).toBe('Informe o mês de início da mensalidade.')
    expect(validarItem(item({ tipo: 'recorrente', mesInicio: '2026-11-01' }))).toBeNull()
    expect(validarItem(item({ desconto: { tipo: 'percentual', valor: 0 } }))).toBe('O desconto deve ser maior que zero.')
    expect(validarItem(item({ desconto: { tipo: 'valor', valor: -5 } }))).toBe('O desconto deve ser maior que zero.')
    expect(validarItem(item({ desconto: { tipo: 'percentual', valor: 10000 } }))).toBe('O desconto deve ser menor que o valor do item.')
    expect(validarItem(item({ desconto: { tipo: 'valor', valor: 150000 } }))).toBe('O desconto deve ser menor que o valor do item.')
  })
})
