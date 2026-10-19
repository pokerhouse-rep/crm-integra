import { describe, it, expect } from 'vitest'
import {
  contarConversao, quebrarConversao, taxa, etapaDoEvento,
  resumirVendas, resumirRecebimentos, contarMotivos, diasEntre,
} from '@/lib/dominio/relatorios'

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

const c = (id: string, leadId: string, dataInicio: string, leadCriadoEm: string, itens: { tipo: 'unico' | 'recorrente'; valorCentavos: number }[]) =>
  ({ id, leadId, dataInicio, leadCriadoEm, itens })

describe('vendas', () => {
  it('soma, tickets e tempo médio só do primeiro contrato do lead', () => {
    const r = resumirVendas(
      [
        c('k1', 'a', '2026-10-10', '2026-10-01', [{ tipo: 'unico', valorCentavos: 150000 }, { tipo: 'recorrente', valorCentavos: 15000 }]),
        c('k2', 'b', '2026-10-15', '2026-10-14', [{ tipo: 'unico', valorCentavos: 100001 }]),
        c('k3', 'a', '2026-10-18', '2026-10-01', [{ tipo: 'recorrente', valorCentavos: 5000 }]),
      ],
      (leadId) => (leadId === 'a' ? 'k1' : 'k2'),
    )
    expect(r).toEqual({ contratos: 3, unicoCentavos: 250001, mensalCentavos: 20000, ticketUnicoCentavos: 83334, ticketMensalCentavos: 6667, tempoMedioDias: 5 })
  })
  it('sem contratos não há tickets nem tempo médio', () => {
    const r = resumirVendas([], () => '')
    expect(r.ticketUnicoCentavos).toBeNull()
    expect(r.ticketMensalCentavos).toBeNull()
    expect(r.tempoMedioDias).toBeNull()
  })
  it('diasEntre', () => {
    expect(diasEntre('2026-10-01', '2026-10-10')).toBe(9)
    expect(diasEntre('2026-02-27', '2026-03-01')).toBe(2)
  })
})

describe('recebimentos', () => {
  it('previsto, recebido, a receber e atrasado', () => {
    expect(resumirRecebimentos([
      { status: 'paga', vencimento: '2026-10-05', valorCentavos: 50000, valorPagoCentavos: 45000 },
      { status: 'aberta', vencimento: '2026-10-10', valorCentavos: 15000, valorPagoCentavos: null },
      { status: 'aberta', vencimento: '2026-10-25', valorCentavos: 15000, valorPagoCentavos: null },
      { status: 'suspensa', vencimento: '2026-10-25', valorCentavos: 9000, valorPagoCentavos: null },
    ], '2026-10-19')).toEqual({ previstoCentavos: 80000, recebidoCentavos: 45000, aReceberCentavos: 30000, atrasadoCentavos: 15000 })
  })
})

describe('motivos de perda', () => {
  it('agrupa, ordena e calcula percentual', () => {
    expect(contarMotivos([{ motivoId: 'm1' }, { motivoId: 'm1' }, { motivoId: null }, { motivoId: 'm2' }], (id) => ({ m1: 'Sem orçamento', m2: 'Outro' } as Record<string, string>)[id]))
      .toEqual([{ nome: 'Sem orçamento', quantidade: 2, percentual: 50 }, { nome: 'Outro', quantidade: 1, percentual: 25 }, { nome: 'Sem motivo', quantidade: 1, percentual: 25 }])
  })
  it('id sem nome entra como Sem motivo; vazio devolve lista vazia', () => {
    expect(contarMotivos([{ motivoId: 'x' }], () => undefined)).toEqual([{ nome: 'Sem motivo', quantidade: 1, percentual: 100 }])
    expect(contarMotivos([], () => undefined)).toEqual([])
  })
})
