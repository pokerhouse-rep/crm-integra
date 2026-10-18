import { describe, it, expect } from 'vitest'
import { gerarDatasSequencia, gerarDatasReativacao, planejarResultado } from '@/lib/dominio/sequencia'
import { ETAPAS } from '@/lib/dominio/tipos'

const base = { hoje: '2026-10-19', pendentesRestantes: 0, offsetsPadrao: [2, 5, 10], diasReativacao: 30 }

describe('sequencia', () => {
  it('gera D+2, D+5, D+10 ajustando fim de semana', () => {
    expect(gerarDatasSequencia('2026-10-19', [2, 5, 10])).toEqual(['2026-10-21', '2026-10-26', '2026-10-29'])
  })
  it('reativação mantém os intervalos a partir de +30', () => {
    expect(gerarDatasReativacao('2026-10-19', [2, 5, 10], 30)).toEqual(['2026-11-18', '2026-11-23', '2026-11-26'])
  })
  it('rótulos das etapas', () => {
    expect(ETAPAS.map(e => e.rotulo)).toEqual(
      ['Prospect', 'MVP enviado', 'Em conversa', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido'])
  })
  it('respondeu', () => {
    expect(planejarResultado({ ...base, resultado: 'respondeu', pendentesRestantes: 2 })).toEqual({
      cancelarPendentes: true, novaEtapa: 'em_conversa', novosRetornos: [], frio: 'limpar', pedirMotivoPerda: false,
    })
  })
  it('pediu tempo respeita a data escolhida, mesmo num sábado', () => {
    const p = planejarResultado({ ...base, resultado: 'pediu_tempo', novaData: '2026-10-24', pendentesRestantes: 2 })
    expect(p).toEqual({
      cancelarPendentes: true, novaEtapa: null, novosRetornos: [{ data: '2026-10-24', origem: 'adiado' }],
      frio: 'limpar', pedirMotivoPerda: false,
    })
  })
  it('pediu tempo sem novaData lança erro', () => {
    expect(() => planejarResultado({ ...base, resultado: 'pediu_tempo' })).toThrow('novaData obrigatória')
  })
  it('sem interesse', () => {
    expect(planejarResultado({ ...base, resultado: 'sem_interesse', pendentesRestantes: 1 })).toEqual({
      cancelarPendentes: true, novaEtapa: 'perdido', novosRetornos: [], frio: 'limpar', pedirMotivoPerda: true,
    })
  })
  it('sem resposta com pendentes restantes não vira frio', () => {
    const p = planejarResultado({ ...base, resultado: 'sem_resposta', pendentesRestantes: 1 })
    expect(p).toEqual({
      cancelarPendentes: false, novaEtapa: null, novosRetornos: [], frio: 'manter', pedirMotivoPerda: false,
    })
  })
  it('último sem resposta vira frio e agenda novo ciclo completo', () => {
    const p = planejarResultado({ ...base, resultado: 'sem_resposta' })
    expect(p.frio).toBe('marcar')
    expect(p.cancelarPendentes).toBe(false)
    expect(p.pedirMotivoPerda).toBe(false)
    expect(p.novosRetornos.map(r => r.data)).toEqual(['2026-11-18', '2026-11-23', '2026-11-26'])
    expect(p.novosRetornos.every(r => r.origem === 'reativacao')).toBe(true)
    expect(p.novaEtapa).toBeNull()
  })
  it('frio que responde: limpa frio, cancela pendentes e vai para em_conversa', () => {
    const p = planejarResultado({ ...base, resultado: 'respondeu', hoje: '2026-11-18', pendentesRestantes: 2 })
    expect(p).toMatchObject({ frio: 'limpar', cancelarPendentes: true, novaEtapa: 'em_conversa' })
  })
})
