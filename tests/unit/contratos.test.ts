import { describe, expect, it } from 'vitest'
import { descreverItem } from '@/lib/dominio/contratos'

describe('descreverItem', () => {
  it('único parcelado', () => {
    expect(descreverItem({ tipo: 'unico', valor_centavos: 135000, parcelas: 3, mes_inicio: null })).toBe('R$ 1.350,00 em 3x')
  })
  it('único à vista', () => {
    expect(descreverItem({ tipo: 'unico', valor_centavos: 90000, parcelas: 1, mes_inicio: null })).toBe('R$ 900,00 à vista')
  })
  it('mensal com início', () => {
    expect(descreverItem({ tipo: 'recorrente', valor_centavos: 15000, parcelas: 1, mes_inicio: '2026-11-01' })).toBe('R$ 150,00/mês desde 11/2026')
  })
  it('mensal sem início', () => {
    expect(descreverItem({ tipo: 'recorrente', valor_centavos: 15000, parcelas: 1, mes_inicio: null })).toBe('R$ 150,00/mês')
  })
})
