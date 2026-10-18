import { describe, it, expect } from 'vitest'
import {
  competenciaDe, somarMeses, vencimentoNaCompetencia, horizonteCobrancas, diaVencimentoPadrao,
  planejarCobrancasIniciais, competenciasFaltantes, valorVigente, situacaoCobranca, resumirMes,
  rotuloCobranca, mensagemCobranca,
} from '@/lib/dominio/cobrancas'

const resumo = (p: ReturnType<typeof planejarCobrancasIniciais>) =>
  p.map(c => [c.tipo, c.numero, c.vencimento, c.valorCentavos])

describe('cobrancas', () => {
  it('competências e vencimentos', () => {
    expect(competenciaDe('2026-10-19')).toBe('2026-10-01')
    expect(somarMeses('2026-11-01', 2)).toBe('2027-01-01')
    expect(somarMeses('2026-01-01', -1)).toBe('2025-12-01')
    expect(vencimentoNaCompetencia('2026-02-01', 28)).toBe('2026-02-28')
    expect(horizonteCobrancas('2026-12-05')).toBe('2027-01-01')
    expect(diaVencimentoPadrao('2026-10-31')).toBe(28)
    expect(diaVencimentoPadrao('2026-10-19')).toBe(19)
  })

  it('critério 6: 3 parcelas de 450,00 e mensalidade a partir de novembro', () => {
    const p = planejarCobrancasIniciais(
      [{ tipo: 'unico', valorCentavos: 135000, parcelas: 3, mesInicio: null },
       { tipo: 'recorrente', valorCentavos: 15000, parcelas: 1, mesInicio: '2026-11-01' }],
      { diaVencimento: 19, primeiroVencimento: '2026-10-19', ate: '2026-11-01' })
    expect(resumo(p)).toEqual([
      ['parcela', 1, '2026-10-19', 45000], ['parcela', 2, '2026-11-19', 45000], ['parcela', 3, '2026-12-19', 45000],
      ['mensalidade', null, '2026-11-19', 15000],
    ])
    expect(p[0]).toMatchObject({ itemIndice: 0, totalParcelas: 3, competencia: null })
    expect(p[3]).toMatchObject({ itemIndice: 1, totalParcelas: null, competencia: '2026-11-01' })
  })

  it('aceite em 31/10 com dia 28: 31/10, 28/11, 28/12', () => {
    const p = planejarCobrancasIniciais(
      [{ tipo: 'unico', valorCentavos: 100000, parcelas: 3, mesInicio: null }],
      { diaVencimento: diaVencimentoPadrao('2026-10-31'), primeiroVencimento: '2026-10-31', ate: '2026-11-01' })
    expect(resumo(p)).toEqual([
      ['parcela', 1, '2026-10-31', 33334], ['parcela', 2, '2026-11-28', 33333], ['parcela', 3, '2026-12-28', 33333],
    ])
  })

  it('à vista vence no primeiro vencimento', () => {
    const p = planejarCobrancasIniciais(
      [{ tipo: 'unico', valorCentavos: 150000, parcelas: 1, mesInicio: null }],
      { diaVencimento: 19, primeiroVencimento: '2026-10-19', ate: '2026-11-01' })
    expect(p).toEqual([{ itemIndice: 0, tipo: 'avista', numero: null, totalParcelas: null, competencia: null, vencimento: '2026-10-19', valorCentavos: 150000 }])
  })

  it('mensalidade que começa depois do horizonte não gera nada', () => {
    const p = planejarCobrancasIniciais(
      [{ tipo: 'recorrente', valorCentavos: 15000, parcelas: 1, mesInicio: '2026-12-01' }],
      { diaVencimento: 19, primeiroVencimento: '2026-10-19', ate: '2026-11-01' })
    expect(p).toEqual([])
  })

  it('mensalidade gera todas as competências até o horizonte, inclusive', () => {
    const p = planejarCobrancasIniciais(
      [{ tipo: 'recorrente', valorCentavos: 15000, parcelas: 1, mesInicio: '2026-11-01' }],
      { diaVencimento: 5, primeiroVencimento: '2026-10-19', ate: '2027-01-01' })
    expect(p.map(c => [c.competencia, c.vencimento])).toEqual([
      ['2026-11-01', '2026-11-05'], ['2026-12-01', '2026-12-05'], ['2027-01-01', '2027-01-05'],
    ])
  })

  it('competências faltantes', () => {
    expect(competenciasFaltantes('2026-11-01', '2027-01-01', ['2026-11-01'])).toEqual(['2026-12-01', '2027-01-01'])
    expect(competenciasFaltantes('2026-11-01', '2026-11-01', ['2026-11-01'])).toEqual([])
    expect(competenciasFaltantes('2026-12-01', '2026-11-01', [])).toEqual([])
  })

  it('valor vigente', () => {
    const r = [{ aPartirDe: '2027-01-01', valorCentavos: 18000 }]
    expect(valorVigente(15000, r, '2026-12-01')).toBe(15000)
    expect(valorVigente(15000, r, '2027-01-01')).toBe(18000)
    expect(valorVigente(15000, r, '2027-02-01')).toBe(18000)
    expect(valorVigente(15000, [...r, { aPartirDe: '2027-06-01', valorCentavos: 20000 }, { aPartirDe: '2027-03-01', valorCentavos: 19000 }], '2027-04-01')).toBe(19000)
    expect(valorVigente(15000, [], '2027-04-01')).toBe(15000)
  })

  it('situação da cobrança', () => {
    const c = { status: 'aberta' as const, vencimento: '2026-11-19' }
    expect(situacaoCobranca(c, '2026-11-15', 3)).toBe('futura')
    expect(situacaoCobranca(c, '2026-11-16', 3)).toBe('vencendo')
    expect(situacaoCobranca(c, '2026-11-19', 3)).toBe('vencendo')
    expect(situacaoCobranca(c, '2026-11-20', 3)).toBe('atrasada')
    expect(situacaoCobranca({ status: 'paga', vencimento: '2026-11-19' }, '2026-11-20', 3)).toBe('paga')
    expect(situacaoCobranca({ status: 'suspensa', vencimento: '2026-11-19' }, '2026-11-20', 3)).toBe('suspensa')
  })

  it('resumo do mês', () => {
    expect(resumirMes([
      { status: 'paga', valorCentavos: 15000, valorPagoCentavos: 14000 },
      { status: 'aberta', valorCentavos: 45000, valorPagoCentavos: null },
      { status: 'suspensa', valorCentavos: 9000, valorPagoCentavos: null },
    ])).toEqual({ previstoCentavos: 60000, recebidoCentavos: 14000, aReceberCentavos: 45000 })
    expect(resumirMes([])).toEqual({ previstoCentavos: 0, recebidoCentavos: 0, aReceberCentavos: 0 })
  })

  it('rótulos', () => {
    const base = { numero: null, totalParcelas: null, competencia: null }
    expect(rotuloCobranca({ ...base, descricaoItem: 'Site', tipo: 'avista' })).toBe('Site · à vista')
    expect(rotuloCobranca({ descricaoItem: 'Site', tipo: 'parcela', numero: 2, totalParcelas: 3, competencia: null })).toBe('Site · parcela 2 de 3')
    expect(rotuloCobranca({ descricaoItem: 'Hospedagem', tipo: 'mensalidade', numero: null, totalParcelas: null, competencia: '2026-11-01' }))
      .toBe('Hospedagem · mensalidade 11/2026')
  })

  it('mensagens', () => {
    const c = { nome: 'Maria', rotulo: 'Site · parcela 2 de 3', valorCentavos: 45000, vencimento: '2026-11-19' }
    expect(mensagemCobranca(c, '2026-11-20'))
      .toBe('Olá Maria! O pagamento de Site · parcela 2 de 3, no valor de R$ 450,00, venceu em 19/11/2026. Consegue verificar para mim? Qualquer dúvida, estou à disposição.')
    expect(mensagemCobranca(c, '2026-11-19'))
      .toBe('Olá Maria! Passando para lembrar do pagamento de Site · parcela 2 de 3, no valor de R$ 450,00, com vencimento em 19/11/2026. Qualquer dúvida, estou à disposição.')
  })
})
