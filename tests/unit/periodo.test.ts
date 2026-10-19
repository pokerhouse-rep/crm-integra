import { describe, it, expect } from 'vitest'
import { resolverPeriodo, intervaloUTC, dataEmPalmas, rotuloPeriodo, PERIODOS } from '@/lib/dominio/periodo'

const HOJE = '2026-10-19'

describe('periodo', () => {
  it('padrão é este mês', () => {
    expect(resolverPeriodo({}, HOJE)).toEqual({ chave: 'mes', de: '2026-10-01', ate: '2026-10-19' })
  })
  it('mês passado, inclusive na virada de ano', () => {
    expect(resolverPeriodo({ periodo: 'mes_passado' }, HOJE)).toMatchObject({ de: '2026-09-01', ate: '2026-09-30' })
    expect(resolverPeriodo({ periodo: 'mes_passado' }, '2026-01-10')).toMatchObject({ de: '2025-12-01', ate: '2025-12-31' })
  })
  it('últimos 30 e 90 dias e este ano', () => {
    expect(resolverPeriodo({ periodo: '30d' }, HOJE)).toMatchObject({ de: '2026-09-20', ate: HOJE })
    expect(resolverPeriodo({ periodo: '90d' }, HOJE)).toMatchObject({ de: '2026-07-22', ate: HOJE })
    expect(resolverPeriodo({ periodo: 'ano' }, HOJE)).toMatchObject({ de: '2026-01-01', ate: HOJE })
  })
  it('personalizado troca datas invertidas', () => {
    expect(resolverPeriodo({ periodo: 'personalizado', de: '2026-10-10', ate: '2026-10-01' }, HOJE))
      .toEqual({ chave: 'personalizado', de: '2026-10-01', ate: '2026-10-10' })
  })
  it('data inválida ou período desconhecido volta ao padrão', () => {
    expect(resolverPeriodo({ periodo: 'personalizado', de: '2026-02-30', ate: '2026-10-01' }, HOJE).chave).toBe('mes')
    expect(resolverPeriodo({ periodo: 'personalizado' }, HOJE).chave).toBe('mes')
    expect(resolverPeriodo({ periodo: 'xyz' }, HOJE).chave).toBe('mes')
  })
  it('intervalo UTC e data em Palmas', () => {
    expect(intervaloUTC({ de: '2026-10-01', ate: '2026-10-31' })).toEqual({ inicio: '2026-10-01T03:00:00Z', fim: '2026-11-01T03:00:00Z' })
    expect(dataEmPalmas('2026-11-01T02:30:00Z')).toBe('2026-10-31')
  })
  it('rótulos', () => {
    expect(rotuloPeriodo({ chave: 'mes', de: '2026-10-01', ate: HOJE })).toBe('01/10/2026 a 19/10/2026')
    expect(PERIODOS.map((p) => p.rotulo)).toEqual(['Este mês', 'Mês passado', 'Últimos 30 dias', 'Últimos 90 dias', 'Este ano', 'Personalizado'])
  })
})
