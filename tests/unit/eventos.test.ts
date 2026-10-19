import { describe, expect, it } from 'vitest'
import { descreverEvento } from '@/lib/dominio/eventos'

describe('descreverEvento', () => {
  it('criado', () => {
    expect(descreverEvento('criado', {}).texto).toBe('Lead cadastrado')
  })
  it('etapa alterada usa rótulos', () => {
    expect(descreverEvento('etapa_alterada', { de: 'prospect', para: 'proposta_enviada' }).texto).toBe(
      'Etapa: Prospect → Proposta enviada',
    )
  })
  it('retorno feito com resultado e nova data', () => {
    const e = descreverEvento('retorno_feito', { resultado: 'respondeu', nova_data: '2026-10-20' })
    expect(e.texto).toBe('Retorno feito: Respondeu')
    expect(e.detalhe).toBe('Nova data: 20/10/2026')
  })
  it('proposta enviada com versão e valor', () => {
    expect(descreverEvento('proposta_enviada', { versao: 2, total_unico: 150000, total_recorrente: 0 }).texto).toBe(
      'Proposta enviada (v2 · R$ 1.500,00)',
    )
  })
  it('tipo desconhecido volta o próprio tipo', () => {
    expect(descreverEvento('xyz', null).texto).toBe('xyz')
  })
})
