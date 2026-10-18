import { describe, it, expect } from 'vitest'
import { normalizarTelefone, formatarTelefone } from '@/lib/dominio/telefone'

describe('telefone', () => {
  it('normaliza formatos comuns', () => {
    expect(normalizarTelefone('(63) 99999-0000')).toBe('5563999990000')
    expect(normalizarTelefone('+55 63 9 9999-0000')).toBe('5563999990000')
    expect(normalizarTelefone('63 3214-0000')).toBe('556332140000')
  })
  it('rejeita entradas inválidas', () => {
    expect(normalizarTelefone('99999-0000')).toBeNull()
    expect(normalizarTelefone('abc')).toBeNull()
    expect(normalizarTelefone('')).toBeNull()
    expect(normalizarTelefone('4463999990000')).toBeNull() // 13 dígitos sem 55
  })
  it('formata celular e fixo', () => {
    expect(formatarTelefone('5563999990000')).toBe('(63) 99999-0000')
    expect(formatarTelefone('556332140000')).toBe('(63) 3214-0000')
  })
})
