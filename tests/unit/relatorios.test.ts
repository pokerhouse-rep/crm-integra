import { describe, it, expect } from 'vitest'
import { contarConversao, quebrarConversao, taxa, etapaDoEvento } from '@/lib/dominio/relatorios'

const ev = (leadId: string, tipo: string, dados = {}) => ({ leadId, tipo, dados })

describe('conversão', () => {
  it('conta leads distintos por etapa', () => {
    expect(contarConversao([
      ev('a', 'mvp_enviado'), ev('a', 'mvp_enviado'), ev('b', 'mvp_enviado'),
      ev('a', 'retorno_feito', { resultado: 'respondeu' }), ev('a', 'etapa_alterada', { de: 'mvp_enviado', para: 'em_conversa' }),
      ev('b', 'retorno_feito', { resultado: 'sem_resposta' }),
      ev('c', 'etapa_alterada', { de: 'prospect', para: 'em_conversa' }),
      ev('a', 'proposta_enviada'), ev('a', 'proposta_aceita'), ev('a', 'etapa_alterada', { para: 'fechado' }),
    ])).toEqual({ mvp: 2, resposta: 2, proposta: 1, fechamento: 1 })
  })
  it('etapaDoEvento ignora eventos sem etapa e dados nulos', () => {
    expect(etapaDoEvento({ leadId: 'a', tipo: 'nota', dados: null })).toBeNull()
    expect(etapaDoEvento({ leadId: 'a', tipo: 'retorno_feito', dados: null })).toBeNull()
    expect(etapaDoEvento(ev('a', 'etapa_alterada', { para: 'perdido' }))).toBeNull()
  })
  it('quebra por grupo', () => {
    const q = quebrarConversao([ev('a', 'mvp_enviado'), ev('b', 'mvp_enviado'), ev('b', 'proposta_aceita')], (id) => (id === 'a' ? 'n1' : null))
    expect(q.get('n1')).toEqual({ mvp: 1, resposta: 0, proposta: 0, fechamento: 0 })
    expect(q.get(null)).toEqual({ mvp: 1, resposta: 0, proposta: 0, fechamento: 1 })
  })
  it('taxa com uma casa e null sem base', () => {
    expect(taxa(1, 3)).toBe(33.3)
    expect(taxa(0, 0)).toBeNull()
  })
})
