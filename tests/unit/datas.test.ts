import { describe, it, expect } from 'vitest'
import { hojeEmPalmas, somarDias, ajustarFimDeSemana, agendarPrazo, formatarDataBR, inicioDaSemana } from '@/lib/dominio/datas'

describe('datas', () => {
  it('hoje em Palmas às 22h locais ainda é o mesmo dia', () => {
    // 2026-10-19T01:00Z = 18/10 22:00 em Palmas (UTC-3)
    expect(hojeEmPalmas(new Date('2026-10-19T01:00:00Z'))).toBe('2026-10-18')
  })
  it('soma dias corridos atravessando mês', () => {
    expect(somarDias('2026-10-30', 5)).toBe('2026-11-04')
  })
  it('soma dias negativos', () => {
    expect(somarDias('2026-11-02', -3)).toBe('2026-10-30')
  })
  it('sábado e domingo vão para segunda', () => {
    expect(ajustarFimDeSemana('2026-10-24')).toBe('2026-10-26') // sábado
    expect(ajustarFimDeSemana('2026-10-25')).toBe('2026-10-26') // domingo
    expect(ajustarFimDeSemana('2026-10-23')).toBe('2026-10-23') // sexta
  })
  it('agendarPrazo: quinta 22/10 + 2 = sábado → segunda 26/10', () => {
    expect(agendarPrazo('2026-10-22', 2)).toBe('2026-10-26')
  })
  it('formata em pt-BR', () => {
    expect(formatarDataBR('2026-10-05')).toBe('05/10/2026')
  })
  it('início da semana é segunda', () => {
    expect(inicioDaSemana('2026-10-18')).toBe('2026-10-12') // domingo → segunda anterior
    expect(inicioDaSemana('2026-10-19')).toBe('2026-10-19')
  })
})
