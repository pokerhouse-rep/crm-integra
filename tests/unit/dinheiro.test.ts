import { describe, it, expect } from 'vitest'
import { formatarReais, lerReais, lerPercentual, formatarPercentual, formatarValorNegociacao, reaisParaCampo, percentualParaCampo } from '@/lib/dominio/dinheiro'

describe('dinheiro', () => {
  it('formata reais com espaço comum', () => {
    expect(formatarReais(150000)).toBe('R$ 1.500,00')
    expect(formatarReais(5)).toBe('R$ 0,05')
  })

  it('lê valores digitados em vários formatos', () => {
    expect(lerReais('1500')).toBe(150000)
    expect(lerReais('1.500')).toBe(150000)
    expect(lerReais('1.500,00')).toBe(150000)
    expect(lerReais('1500,5')).toBe(150050)
    expect(lerReais('1500.50')).toBe(150050)
    expect(lerReais('R$ 150')).toBe(15000)
    expect(lerReais('1.234.567,89')).toBe(123456789)
    expect(lerReais('10000000')).toBe(1_000_000_000)
  })

  it('rejeita valores inválidos', () => {
    for (const t of ['', 'abc', '1,234', '-10', '1.50.0', '10000000,01']) expect(lerReais(t)).toBeNull()
  })

  it('lê percentual', () => {
    expect(lerPercentual('10')).toBe(1000)
    expect(lerPercentual('7,5')).toBe(750)
    expect(lerPercentual('7.5')).toBe(750)
    expect(lerPercentual('100')).toBe(10000)
    for (const t of ['', '100,01', '0,005', 'x']) expect(lerPercentual(t)).toBeNull()
  })

  it('formata percentual', () => {
    expect(formatarPercentual(750)).toBe('7,5%')
    expect(formatarPercentual(1000)).toBe('10%')
    expect(formatarPercentual(333)).toBe('3,33%')
  })

  it('formata valor de negociação', () => {
    expect(formatarValorNegociacao({ unicoCentavos: 150000, recorrenteCentavos: 15000 })).toBe('R$ 1.500,00 + R$ 150,00/mês')
    expect(formatarValorNegociacao({ unicoCentavos: 150000, recorrenteCentavos: 0 })).toBe('R$ 1.500,00')
    expect(formatarValorNegociacao({ unicoCentavos: 0, recorrenteCentavos: 15000 })).toBe('R$ 150,00/mês')
    expect(formatarValorNegociacao({ unicoCentavos: 0, recorrenteCentavos: 0 })).toBe('')
  })

  it('reaisParaCampo gera texto que lerReais le de volta', () => {
    expect(reaisParaCampo(150000)).toBe('1500,00')
    expect(reaisParaCampo(5)).toBe('0,05')
    expect(lerReais(reaisParaCampo(123456))).toBe(123456)
  })
})

describe('percentualParaCampo', () => {
  it('formata centésimos e é lido de volta por lerPercentual', () => {
    expect(percentualParaCampo(1000)).toBe('10')
    expect(percentualParaCampo(750)).toBe('7,5')
    expect(percentualParaCampo(333)).toBe('3,33')
    for (const c of [1, 50, 750, 1000, 10000]) expect(lerPercentual(percentualParaCampo(c))).toBe(c)
  })
})
