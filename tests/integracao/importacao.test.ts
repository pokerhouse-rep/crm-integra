import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { criarUsuarioTeste } from './helpers'
import { listarOpcoes } from '@/lib/servicos/config'
import { importarLeads, previaImportacao } from '@/lib/servicos/importacao'
import { criarLead } from '@/lib/servicos/leads'

function win1252(texto: string): Uint8Array {
  // Só caracteres Latin-1 usados nos testes (á, í, é, ã, ç, ...): 1 byte cada.
  return Uint8Array.from(Array.from(texto, (c) => c.charCodeAt(0)))
}

describe('importação de leads', () => {
  it('prévia marca duplicado do CRM e importa só os novos', async () => {
    const { cliente } = await criarUsuarioTeste()
    await criarLead(cliente, { nomeContato: 'Existente', whatsapp: '63988887777' })
    const nicho = (await listarOpcoes(cliente, 'nicho')).find((o) => o.nome === 'Clínica')!
    const csv = 'nome;whatsapp;nicho\r\nJoão;63 99999-8888;Clínica\r\nDuda;63988887777;\r\n'
    const previa = await previaImportacao(cliente, win1252(csv), { nichoId: null, origemId: null })
    expect(previa.linhas.map((l) => l.situacao)).toEqual(['nova', 'duplicada_crm'])
    expect(previa.linhas[0].dados?.nomeContato).toBe('João')
    expect(previa.linhas[0].dados?.nichoId).toBe(nicho.id)

    const novas = previa.linhas.filter((l) => l.situacao === 'nova').map((l) => l.dados!)
    expect(await importarLeads(cliente, novas)).toEqual({ importados: 1, ignorados: 0 })

    const { data: lead } = await cliente.from('leads').select('id, etapa').eq('whatsapp', '5563999998888').single()
    expect(lead?.etapa).toBe('prospect')
    const { data: eventos } = await cliente.from('eventos').select('tipo, dados').eq('lead_id', lead!.id)
    expect(eventos?.some((e) => e.tipo === 'criado' && e.dados?.importado === true)).toBe(true)
  })

  it('importar duas vezes não duplica', async () => {
    const { cliente } = await criarUsuarioTeste()
    const dados = [{ nomeContato: 'Eva', whatsapp: '63977776666' }]
    expect(await importarLeads(cliente, dados)).toEqual({ importados: 1, ignorados: 0 })
    expect(await importarLeads(cliente, dados)).toEqual({ importados: 0, ignorados: 1 })
  })

  it('recusa linha inválida na confirmação', async () => {
    const { cliente } = await criarUsuarioTeste()
    await expect(importarLeads(cliente, [{ nomeContato: 'X', whatsapp: '123' }])).rejects.toThrow(
      'Há linhas inválidas. Gere a prévia de novo.',
    )
  })

  it('descarta link e e-mail inválidos na confirmação', async () => {
    const { cliente } = await criarUsuarioTeste()
    const dados = [{ nomeContato: 'Fa', whatsapp: '63966665555', linkMvp: 'javascript:alert(1)', email: 'x@' }]
    expect(await importarLeads(cliente, dados)).toEqual({ importados: 1, ignorados: 0 })
    const { data } = await cliente.from('leads').select('link_mvp, email').eq('whatsapp', '5563966665555').single()
    expect(data).toEqual({ link_mvp: null, email: null })
    await expect(
      importarLeads(cliente, [{ nomeContato: 'G', whatsapp: '63955554444', empresa: 5 as unknown as string }]),
    ).rejects.toThrow('Há linhas inválidas. Gere a prévia de novo.')
  })

  it('arquivo vazio, grande demais e sem cabeçalho válido', async () => {
    const { cliente } = await criarUsuarioTeste()
    const padroes = { nichoId: null, origemId: null }
    await expect(previaImportacao(cliente, win1252('nome;whatsapp\r\n'), padroes)).rejects.toThrow('A planilha está vazia.')
    await expect(previaImportacao(cliente, new Uint8Array(1_048_577), padroes)).rejects.toThrow('Arquivo maior que 1 MB.')
    await expect(previaImportacao(cliente, win1252('a;b\r\n1;2\r\n'), padroes)).rejects.toThrow('A planilha precisa das colunas')
  })

  it('importar_leads recusa mais de 1000', async () => {
    const { cliente } = await criarUsuarioTeste()
    const item = { nome_contato: 'A', whatsapp: '5563999990000' }
    const { error } = await cliente.rpc('importar_leads', { p_leads: Array(1001).fill(item) })
    expect(error?.message).toBe('Importe no máximo 1000 leads por vez.')
  })

  it('anônimo não executa importar_leads', async () => {
    const anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await anonimo.rpc('importar_leads', { p_leads: [] })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })
})
