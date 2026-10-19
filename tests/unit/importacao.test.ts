import { describe, expect, it } from 'vitest'
import {
  LIMITE_BYTES_IMPORTACAO,
  LIMITE_LINHAS_IMPORTACAO,
  mapearCabecalho,
  normalizarTexto,
  validarLinhas,
} from '@/lib/dominio/importacao'

describe('importacao', () => {
  it('normaliza texto', () => {
    expect(normalizarTexto('  Clínica   Médica ')).toBe('clinica medica')
  })

  it('mapeia cabecalho com sinonimos', () => {
    expect(mapearCabecalho(['Nome do Contato', 'Celular', 'Segmento', 'Coluna X']))
      .toEqual({ colunas: ['nome', 'whatsapp', 'nicho', null], ignoradas: ['Coluna X'], erro: null })
    expect(mapearCabecalho(['Empresa']).erro).toBe('A planilha precisa das colunas "nome" e "whatsapp".')
  })

  it('coluna repetida vale a primeira', () => {
    const r = mapearCabecalho(['Nome', 'Telefone', 'Zap'])
    expect(r.colunas).toEqual(['nome', 'whatsapp', null])
  })

  it('exporta limites', () => {
    expect(LIMITE_LINHAS_IMPORTACAO).toBe(1000)
    expect(LIMITE_BYTES_IMPORTACAO).toBe(1_048_576)
  })

  it('valida linhas', () => {
    const o = {
      nichos: [{ id: 'n1', nome: 'Clínica' }],
      origens: [{ id: 'o1', nome: 'Prospecção ativa' }],
      nichoPadraoId: null,
      origemPadraoId: 'o1',
      whatsappsExistentes: new Set(['5563988887777']),
    }
    const cols = ['nome', 'whatsapp', 'nicho'] as const
    const r = validarLinhas([
      ['Ana', '63 99999-8888', 'clinica'],
      ['Bia', '+55 (63) 99999-8888', ''],
      ['Caio', '6,39E+10', ''],
      ['', '63977776666', ''],
      ['Duda', '63988887777', ''],
      ['Eva', '5563966665555', 'Padaria'],
    ], [...cols], o)
    expect(r.map((l) => l.situacao)).toEqual(['nova', 'duplicada_planilha', 'invalida', 'invalida', 'duplicada_crm', 'nova'])
    expect(r[0].dados).toMatchObject({ nomeContato: 'Ana', whatsapp: '5563999998888', nichoId: 'n1', origemId: 'o1' })
    expect(r[0].numero).toBe(2)
    expect(r[1].motivo).toBe('WhatsApp repetido na planilha (linha 2).')
    expect(r[1].dados).toBeNull()
    expect(r[2].motivo).toBe('WhatsApp inválido.')
    expect(r[3].motivo).toBe('Nome vazio.')
    expect(r[4].motivo).toBe('WhatsApp já cadastrado no CRM.')
    expect(r[5].avisos).toEqual(['Nicho "Padaria" não cadastrado; ficará em branco.'])
    expect(r[5].dados?.nichoId ?? null).toBeNull()
  })

  it('campos opcionais, linhas curtas e origem desconhecida', () => {
    const o = { nichos: [], origens: [], nichoPadraoId: null, origemPadraoId: null, whatsappsExistentes: new Set<string>() }
    const r = validarLinhas([['Ana', '63999998888', ' a@b.com ', 'Indicação']], ['nome', 'whatsapp', 'email', 'origem', 'cidade'], o)
    expect(r[0].dados?.email).toBe('a@b.com')
    expect(r[0].dados?.cidade).toBeUndefined()
    expect(r[0].avisos).toEqual(['Origem "Indicação" não cadastrada; ficará em branco.'])
  })

  it('link e e-mail inválidos ficam em branco com aviso', () => {
    const o = { nichos: [], origens: [], nichoPadraoId: null, origemPadraoId: null, whatsappsExistentes: new Set<string>() }
    const r = validarLinhas([['Ana', '63999998888', 'x@', 'javascript:alert(1)']], ['nome', 'whatsapp', 'email', 'link_mvp'], o)
    expect(r[0].situacao).toBe('nova')
    expect(r[0].dados?.email).toBeUndefined()
    expect(r[0].dados?.linkMvp).toBeUndefined()
    expect(r[0].avisos).toEqual(['E-mail inválido; ficará em branco.', 'Link do MVP inválido; ficará em branco.'])
  })

  it('link sem // fica em branco com aviso', () => {
    const o = { nichos: [], origens: [], nichoPadraoId: null, origemPadraoId: null, whatsappsExistentes: new Set<string>() }
    const r = validarLinhas([['Ana', '63999998888', 'http:foo.com']], ['nome', 'whatsapp', 'link_mvp'], o)
    expect(r[0].dados?.linkMvp).toBeUndefined()
    expect(r[0].avisos).toEqual(['Link do MVP inválido; ficará em branco.'])
  })

  it('linhas recusadas guardam os valores crus', () => {
    const o = { nichos: [], origens: [], nichoPadraoId: null, origemPadraoId: null, whatsappsExistentes: new Set<string>() }
    const r = validarLinhas([['Ana', '123']], ['nome', 'whatsapp'], o)
    expect(r[0].bruto).toEqual({ nome: 'Ana', whatsapp: '123' })
  })
})
