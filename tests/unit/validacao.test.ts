import { describe, it, expect } from 'vitest'
import { dataValida, horaValida, uuidValido } from '@/lib/validacao'

describe('validacao', () => {
  it('dataValida aceita datas reais e rejeita as impossíveis', () => {
    expect(dataValida('2026-10-18')).toBe(true)
    expect(dataValida('2028-02-29')).toBe(true)
    expect(dataValida('2026-02-29')).toBe(false)
    expect(dataValida('2026-13-45')).toBe(false)
    expect(dataValida('18/10/2026')).toBe(false)
    expect(dataValida('')).toBe(false)
  })
  it('horaValida', () => {
    expect(horaValida('09:30')).toBe(true)
    expect(horaValida('23:59')).toBe(true)
    expect(horaValida('24:00')).toBe(false)
    expect(horaValida('9:30')).toBe(false)
  })
  it('uuidValido', () => {
    expect(uuidValido('cf9cac3b-2d2d-4ce7-a462-8f6cadd6c970')).toBe(true)
    expect(uuidValido('lixo')).toBe(false)
  })
})
