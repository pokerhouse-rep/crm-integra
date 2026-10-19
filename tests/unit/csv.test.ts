import { describe, expect, it } from 'vitest'
import { centavosParaCsv, decodificarArquivo, gerarCsv, lerCsv } from '@/lib/dominio/csv'

describe('csv', () => {
  it('gera e le CSV com protecao de formula', () => {
    const csv = gerarCsv([['Nome', 'Obs'], ['João', 'a;b "c"\nlinha 2'], ['=1+1', null], [-3, 'ok']])
    expect(csv.startsWith('\uFEFFNome;Obs\r\n')).toBe(true)
    expect(csv).toContain('João;"a;b ""c""\nlinha 2"\r\n')
    expect(csv).toContain("'=1+1;\r\n")
    expect(lerCsv(csv)).toEqual([['Nome', 'Obs'], ['João', 'a;b "c"\nlinha 2'], ["'=1+1", ''], ["'-3", 'ok']])
  })

  it('protege celulas iniciadas por + @ tab e CR', () => {
    const csv = gerarCsv([['+1', '@x', '\tt', '\rr']])
    expect(csv).toBe("\uFEFF'+1;'@x;'\tt;\"'\rr\"\r\n")
  })

  it('le CSV com virgula e ignora linhas vazias', () => {
    expect(lerCsv('nome,whatsapp\nAna,63999998888\n\n')).toEqual([['nome', 'whatsapp'], ['Ana', '63999998888']])
    expect(lerCsv('a;b\r\nc;d\r\n')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('decodifica UTF-8 e Windows-1252', () => {
    const latin1 = new Uint8Array([0x43, 0x6c, 0xed, 0x6e, 0x69, 0x63, 0x61, 0x3b, 0x4a, 0x6f, 0xe3, 0x6f])
    expect(decodificarArquivo(latin1)).toBe('Clínica;João')
    expect(decodificarArquivo(new TextEncoder().encode('Clínica;João'))).toBe('Clínica;João')
  })

  it('formata centavos', () => {
    expect(centavosParaCsv(150000)).toBe('1500,00')
    expect(centavosParaCsv(-5)).toBe('-0,05')
    expect(centavosParaCsv(0)).toBe('0,00')
  })
})
