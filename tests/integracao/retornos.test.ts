import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { criarUsuarioTeste } from './helpers'
import { criarLead, obterLead } from '@/lib/servicos/leads'
import { agendaDoDia } from '@/lib/servicos/agenda'
import {
  adicionarRetorno,
  alterarDataRetorno,
  aplicarSequencia,
  cancelarRetorno,
  marcarMvpEnviado,
  moverEtapa,
  registrarResultado,
} from '@/lib/servicos/retornos'

async function novoLead(cliente: SupabaseClient, whatsapp = '(63) 99999-0000') {
  return criarLead(cliente, { nomeContato: 'Maria', whatsapp })
}
async function motivo(cliente: SupabaseClient) {
  const { data } = await cliente.from('opcoes').select('id').eq('tipo', 'motivo_perda').limit(1).single()
  return data!.id as string
}
const datas = (det: Awaited<ReturnType<typeof obterLead>>, status = 'pendente') =>
  det.retornos
    .filter((r) => r.status === status)
    .map((r) => r.data_prevista)
    .sort()

describe('serviço de retornos', () => {
  it('marcarMvpEnviado em 2026-10-19 cria retornos 21/10, 26/10, 29/10 e etapa mvp_enviado', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { link: 'https://x.test/demo', hoje: '2026-10-19' })
    const det = await obterLead(cliente, lead.id)
    expect(det.lead.etapa).toBe('mvp_enviado')
    expect(det.lead.link_mvp).toBe('https://x.test/demo')
    expect(det.lead.mvp_enviado_em).toBe('2026-10-19')
    expect(datas(det)).toEqual(['2026-10-21', '2026-10-26', '2026-10-29'])
    expect(det.retornos.every((r) => r.origem === 'sequencia' && r.ciclo === 1)).toBe(true)
    expect(det.eventos.map((e) => e.tipo)).toContain('mvp_enviado')
  })

  it('marcarMvpEnviado duas vezes falha com "já tem retornos pendentes"', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    await expect(marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })).rejects.toThrow(
      'Este lead já tem retornos pendentes.',
    )
  })

  it('respondeu cancela os outros pendentes e move para em_conversa', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    const det = await obterLead(cliente, lead.id)
    await registrarResultado(cliente, det.retornos.find((r) => r.data_prevista === '2026-10-21')!.id, {
      resultado: 'respondeu',
      hoje: '2026-10-21',
    })
    const depois = await obterLead(cliente, lead.id)
    expect(depois.lead.etapa).toBe('em_conversa')
    expect(datas(depois)).toEqual([])
    expect(datas(depois, 'cancelado')).toHaveLength(2)
    expect(datas(depois, 'feito')).toEqual(['2026-10-21'])
    const tipos = depois.eventos.map((e) => e.tipo)
    expect(tipos).toContain('retorno_feito')
    expect(tipos).toContain('etapa_alterada')
  })

  it('respondeu num lead em negociacao não regride a etapa', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await adicionarRetorno(cliente, lead.id, '2026-10-20')
    await moverEtapa(cliente, lead.id, 'negociacao')
    // moverEtapa para negociacao não cancela pendentes; o retorno segue pendente
    const det = await obterLead(cliente, lead.id)
    await registrarResultado(cliente, det.retornos[0].id, { resultado: 'respondeu', hoje: '2026-10-20' })
    expect((await obterLead(cliente, lead.id)).lead.etapa).toBe('negociacao')
  })

  it('três sem_resposta deixam o lead frio com 3 retornos de ciclo 2 a partir de +30', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    const det = await obterLead(cliente, lead.id)
    const ordenados = [...det.retornos].sort((a, b) => a.data_prevista.localeCompare(b.data_prevista))
    await registrarResultado(cliente, ordenados[0].id, { resultado: 'sem_resposta', hoje: '2026-10-21' })
    expect((await obterLead(cliente, lead.id)).lead.frio).toBe(false)
    await registrarResultado(cliente, ordenados[1].id, { resultado: 'sem_resposta', hoje: '2026-10-26' })
    expect((await obterLead(cliente, lead.id)).lead.frio).toBe(false)
    await registrarResultado(cliente, ordenados[2].id, { resultado: 'sem_resposta', hoje: '2026-10-29' })
    const depois = await obterLead(cliente, lead.id)
    expect(depois.lead.frio).toBe(true)
    const novos = depois.retornos.filter((r) => r.status === 'pendente')
    expect(novos).toHaveLength(3)
    expect(novos.every((r) => r.ciclo === 2 && r.origem === 'reativacao')).toBe(true)
    // 2026-10-29 + 30 = 2026-11-28 (sábado) -> 30/11; +33 = 01/12; +38 = 06/12 (domingo) -> 07/12
    expect(datas(depois)).toEqual(['2026-11-30', '2026-12-01', '2026-12-07'])
    expect(depois.eventos.map((e) => e.tipo)).toContain('frio')
  })

  it('lead frio que responde na reativação sai de frio e cancela os pendentes', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await adicionarRetorno(cliente, lead.id, '2026-10-20')
    const det = await obterLead(cliente, lead.id)
    await registrarResultado(cliente, det.retornos[0].id, { resultado: 'sem_resposta', hoje: '2026-10-20' })
    const frio = await obterLead(cliente, lead.id)
    expect(frio.lead.frio).toBe(true)
    const pend = frio.retornos.find((r) => r.status === 'pendente')!
    await registrarResultado(cliente, pend.id, { resultado: 'respondeu', hoje: '2026-11-20' })
    const depois = await obterLead(cliente, lead.id)
    expect(depois.lead.frio).toBe(false)
    expect(datas(depois)).toEqual([])
    expect(depois.eventos.map((e) => e.tipo)).toContain('reativado')
  })

  it('registrar resultado duas vezes no mesmo retorno falha e não duplica retornos', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await adicionarRetorno(cliente, lead.id, '2026-10-20')
    const det = await obterLead(cliente, lead.id)
    const id = det.retornos[0].id
    await registrarResultado(cliente, id, { resultado: 'sem_resposta', hoje: '2026-10-20' })
    const antes = (await obterLead(cliente, lead.id)).retornos.length
    await expect(registrarResultado(cliente, id, { resultado: 'sem_resposta', hoje: '2026-10-20' })).rejects.toThrow(
      'Este retorno já foi registrado.',
    )
    expect((await obterLead(cliente, lead.id)).retornos.length).toBe(antes)
  })

  it('duas submissões simultâneas registram só uma vez', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await adicionarRetorno(cliente, lead.id, '2026-10-20')
    const id = (await obterLead(cliente, lead.id)).retornos[0].id
    const r = await Promise.allSettled([
      registrarResultado(cliente, id, { resultado: 'sem_resposta', hoje: '2026-10-20' }),
      registrarResultado(cliente, id, { resultado: 'sem_resposta', hoje: '2026-10-20' }),
    ])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    const det = await obterLead(cliente, lead.id)
    expect(det.retornos.filter((x) => x.status === 'pendente')).toHaveLength(3)
  })

  it('cancelar todos os pendentes manualmente não deixa o lead frio', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    const det = await obterLead(cliente, lead.id)
    for (const r of det.retornos) await cancelarRetorno(cliente, r.id)
    const depois = await obterLead(cliente, lead.id)
    expect(depois.lead.frio).toBe(false)
    expect(datas(depois)).toEqual([])
  })

  it('sem_interesse exige motivo e move para perdido', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    const det = await obterLead(cliente, lead.id)
    const id = det.retornos[0].id
    await expect(registrarResultado(cliente, id, { resultado: 'sem_interesse', hoje: '2026-10-21' })).rejects.toThrow(
      'Informe o motivo da perda.',
    )
    expect(datas(await obterLead(cliente, lead.id))).toHaveLength(3)
    const m = await motivo(cliente)
    await registrarResultado(cliente, id, { resultado: 'sem_interesse', motivoPerdaId: m, hoje: '2026-10-21' })
    const depois = await obterLead(cliente, lead.id)
    expect(depois.lead.etapa).toBe('perdido')
    expect(depois.lead.motivo_perda_id).toBe(m)
    expect(datas(depois)).toEqual([])
  })

  it('pediu_tempo cria um retorno na data escolhida e cancela os demais', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    const det = await obterLead(cliente, lead.id)
    // 2026-11-14 é sábado: data manual é respeitada
    await registrarResultado(cliente, det.retornos[0].id, {
      resultado: 'pediu_tempo',
      novaData: '2026-11-14',
      hoje: '2026-10-21',
    })
    const depois = await obterLead(cliente, lead.id)
    expect(datas(depois)).toEqual(['2026-11-14'])
    expect(depois.retornos.find((r) => r.status === 'pendente')!.origem).toBe('adiado')
  })

  it('moverEtapa: perdido exige motivo; fechado marca cliente e cancela pendentes', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    await expect(moverEtapa(cliente, lead.id, 'perdido')).rejects.toThrow('Informe o motivo da perda.')
    await moverEtapa(cliente, lead.id, 'fechado')
    const depois = await obterLead(cliente, lead.id)
    expect(depois.lead.etapa).toBe('fechado')
    expect(depois.lead.cliente).toBe(true)
    expect(datas(depois)).toEqual([])
  })

  it('adicionar e alterar data de retorno respeitam a data manual', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await adicionarRetorno(cliente, lead.id, '2026-10-24') // sábado
    const det = await obterLead(cliente, lead.id)
    expect(det.retornos[0].origem).toBe('manual')
    expect(datas(det)).toEqual(['2026-10-24'])
    await alterarDataRetorno(cliente, det.retornos[0].id, '2026-10-25')
    expect(datas(await obterLead(cliente, lead.id))).toEqual(['2026-10-25'])
  })

  it('aplicarSequencia troca a sequência do lead', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    await aplicarSequencia(cliente, lead.id, [1, 7], '2026-10-19')
    const det = await obterLead(cliente, lead.id)
    expect(datas(det)).toEqual(['2026-10-20', '2026-10-26'])
    expect(datas(det, 'cancelado')).toHaveLength(3)
    expect(det.lead.frio).toBe(false)
  })

  it('aplicarSequencia em lead frio usa o ciclo atual e limpa o frio', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await adicionarRetorno(cliente, lead.id, '2026-10-20')
    const det = await obterLead(cliente, lead.id)
    await registrarResultado(cliente, det.retornos[0].id, { resultado: 'sem_resposta', hoje: '2026-10-20' })
    expect((await obterLead(cliente, lead.id)).lead.frio).toBe(true)
    await aplicarSequencia(cliente, lead.id, [1, 7], '2026-11-02')
    const depois = await obterLead(cliente, lead.id)
    expect(depois.lead.frio).toBe(false)
    const pend = depois.retornos.filter((r) => r.status === 'pendente')
    expect(pend.map((r) => r.data_prevista).sort()).toEqual(['2026-11-03', '2026-11-09'])
    expect(pend.every((r) => r.ciclo === 2)).toBe(true)
  })
  it('re-marcar MVP num lead mvp_enviado sem pendentes cria ciclo 2 (passo 1 de 3)', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-10-19' })
    for (const r of (await obterLead(cliente, lead.id)).retornos) await cancelarRetorno(cliente, r.id)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-11-02' })
    const det = await obterLead(cliente, lead.id)
    expect(det.lead.etapa).toBe('mvp_enviado')
    const pend = det.retornos.filter((r) => r.status === 'pendente')
    expect(pend).toHaveLength(3)
    expect(pend.every((r) => r.ciclo === 2 && r.origem === 'sequencia')).toBe(true)
    const ag = await agendaDoDia(cliente, '2026-11-04')
    const item = ag.hoje.find((i) => i.tipo === 'retorno')
    if (!item || item.tipo !== 'retorno') throw new Error('esperava retorno')
    expect(item.passo).toBe(1)
    expect(item.totalPassos).toBe(3)
  })

  it('re-marcar MVP limpa o frio, usa o maior ciclo + 1 e não regride a etapa', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await adicionarRetorno(cliente, lead.id, '2026-10-20')
    await moverEtapa(cliente, lead.id, 'em_conversa')
    const det = await obterLead(cliente, lead.id)
    await registrarResultado(cliente, det.retornos.find((r) => r.status === 'pendente')!.id, {
      resultado: 'sem_resposta',
      hoje: '2026-10-20',
    })
    const frio = await obterLead(cliente, lead.id)
    expect(frio.lead.frio).toBe(true)
    for (const r of frio.retornos.filter((x) => x.status === 'pendente')) await cancelarRetorno(cliente, r.id)
    await marcarMvpEnviado(cliente, lead.id, { hoje: '2026-11-02' })
    const depois = await obterLead(cliente, lead.id)
    expect(depois.lead.frio).toBe(false)
    expect(depois.lead.etapa).toBe('em_conversa')
    const pend = depois.retornos.filter((r) => r.status === 'pendente')
    expect(pend).toHaveLength(3)
    expect(pend.every((r) => r.ciclo === 3)).toBe(true)
  })

  it('moverEtapa para em_conversa limpa o frio, cancela reativações e mantém retorno manual', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await adicionarRetorno(cliente, lead.id, '2026-10-20')
    const det = await obterLead(cliente, lead.id)
    await registrarResultado(cliente, det.retornos[0].id, { resultado: 'sem_resposta', hoje: '2026-10-20' })
    expect((await obterLead(cliente, lead.id)).lead.frio).toBe(true)
    await adicionarRetorno(cliente, lead.id, '2026-10-30')
    await moverEtapa(cliente, lead.id, 'em_conversa')
    const depois = await obterLead(cliente, lead.id)
    expect(depois.lead.frio).toBe(false)
    expect(depois.lead.etapa).toBe('em_conversa')
    const pend = depois.retornos.filter((r) => r.status === 'pendente')
    expect(pend.map((r) => [r.origem, r.data_prevista])).toEqual([['manual', '2026-10-30']])
    expect(depois.retornos.filter((r) => r.origem === 'reativacao').every((r) => r.status === 'cancelado')).toBe(true)
    expect(depois.eventos.map((e) => e.tipo)).toContain('reativado')
  })

  it('moverEtapa para fora de perdido limpa o motivo da perda', async () => {
    const { cliente } = await criarUsuarioTeste()
    const lead = await novoLead(cliente)
    await moverEtapa(cliente, lead.id, 'perdido', await motivo(cliente))
    expect((await obterLead(cliente, lead.id)).lead.motivo_perda_id).not.toBeNull()
    await moverEtapa(cliente, lead.id, 'em_conversa')
    expect((await obterLead(cliente, lead.id)).lead.motivo_perda_id).toBeNull()
  })
})
