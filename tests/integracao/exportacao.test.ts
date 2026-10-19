import { describe, expect, it } from 'vitest'
import { criarClienteComContrato, criarUsuarioTeste } from './helpers'
import { gerarCsv } from '@/lib/dominio/csv'
import { listarOpcoes } from '@/lib/servicos/config'
import { linhasExportacao } from '@/lib/servicos/exportacao'
import { criarLead } from '@/lib/servicos/leads'
import { criarProposta, enviarProposta, novaVersao, salvarItens } from '@/lib/servicos/propostas'

describe('exportação', () => {
  it('leads exporta nicho pelo nome, etapa pelo rótulo e telefone formatado', async () => {
    const { cliente } = await criarUsuarioTeste()
    const nicho = (await listarOpcoes(cliente, 'nicho')).find((o) => o.nome === 'Clínica')!
    await criarLead(cliente, {
      nomeContato: 'Ana',
      whatsapp: '63999998888',
      nichoId: nicho.id,
      observacoes: '=SOMA(A1)',
    })
    const linhas = await linhasExportacao(cliente, 'leads')
    expect(linhas[0][0]).toBe('Nome')
    expect(linhas).toHaveLength(2)
    const l = linhas[1]
    expect(l[0]).toBe('Ana')
    expect(l[2]).toBe('(63) 99999-8888')
    expect(l[5]).toBe('Clínica')
    expect(l[7]).toBe('Prospect')
    expect(l[8]).toBe('Não')
    expect(l[9]).toBe('Não')
    expect(l[13]).toBe('=SOMA(A1)')
    expect(gerarCsv(linhas)).toContain(";'=SOMA(A1);")
    const hist = await linhasExportacao(cliente, 'historico')
    expect(hist.slice(1).some((h) => h[2] === 'Lead cadastrado')).toBe(true)
  })

  it('cobrancas exporta valor com vírgula e rótulo da cobrança', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarClienteComContrato(cliente)
    const linhas = await linhasExportacao(cliente, 'cobrancas')
    const l = linhas.find((x) => x[2] === 'Site institucional · parcela 1 de 3')
    expect(l).toBeDefined()
    expect(l![4]).toBe('500,00')
  })

  it('propostas tem uma linha por item de cada versão', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await criarLead(cliente, { nomeContato: 'Bia', whatsapp: '63988887777' })
    const propostaId = await criarProposta(cliente, lead.id)
    await salvarItens(cliente, propostaId, [
      { servicoId: null, descricao: 'Site', tipo: 'unico', valorCentavos: 100000, parcelas: 1, mesInicio: null, desconto: { tipo: 'percentual', valor: 1000 } },
      { servicoId: null, descricao: 'Hospedagem', tipo: 'recorrente', valorCentavos: 50000, parcelas: 1, mesInicio: '2026-11-01', desconto: { tipo: 'valor', valor: 15000 } },
    ])
    await enviarProposta(cliente, propostaId, '2026-10-19')
    await novaVersao(cliente, propostaId)
    const linhas = await linhasExportacao(cliente, 'propostas')
    expect(linhas).toHaveLength(5)
    const descontos = linhas.slice(1).map((l) => l[10])
    expect(descontos).toContain('10%')
    expect(descontos).toContain('150,00')
    expect(linhas.slice(1).some((l) => l[9] === '11/2026' && l[6] === 'Mensal')).toBe(true)
  })
})
