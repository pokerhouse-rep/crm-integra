import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, MessageCircle, Pencil } from 'lucide-react'
import { hojeEmPalmas } from '@/lib/dominio/datas'
import { linkWhatsApp, preencherModelo } from '@/lib/dominio/mensagens'
import { formatarTelefone } from '@/lib/dominio/telefone'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarOpcoes, obterConfig, obterModeloAvulso } from '@/lib/servicos/config'
import { obterLead } from '@/lib/servicos/leads'
import { listarTarefasDoLead } from '@/lib/servicos/tarefas'
import { ErroNegocio } from '@/lib/servicos/tipos'
import { BotaoMvpEnviado } from '@/components/leads/BotaoMvpEnviado'
import { EditorRetornos } from '@/components/leads/EditorRetornos'
import { LinhaDoTempo } from '@/components/leads/LinhaDoTempo'
import { SeletorEtapa } from '@/components/leads/SeletorEtapa'
import { TarefasDoLead } from '@/components/leads/TarefasDoLead'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROTULO_ORIGEM: Record<string, string> = {
  sequencia: 'Sequência',
  reativacao: 'Reativação',
  adiado: 'Adiado',
  manual: 'Manual',
  proposta: 'Pós-proposta',
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const db = await criarClienteServidor()
  const hoje = hojeEmPalmas()
  const [detalhe, config, tarefas, motivos, avulso] = await Promise.all([
    obterLead(db, id).catch((e) => {
      if (e instanceof ErroNegocio) return null
      throw e
    }),
    obterConfig(db),
    listarTarefasDoLead(db, id),
    listarOpcoes(db, 'motivo_perda'),
    obterModeloAvulso(db),
  ])
  if (!detalhe) notFound()
  const { lead, retornos, eventos } = detalhe
  const [nichos, origens] = await Promise.all([
    listarOpcoes(db, 'nicho', [lead.nicho_id]),
    listarOpcoes(db, 'origem', [lead.origem_id]),
  ])

  const pendentes = retornos.filter((r) => r.status === 'pendente')
  const mensagem = preencherModelo(avulso?.texto ?? '', {
    nome: lead.nome_contato,
    empresa: lead.empresa,
    link_mvp: lead.link_mvp,
    cidade: lead.cidade,
  })
  const nicho = nichos.find((n) => n.id === lead.nicho_id)?.nome
  const origem = origens.find((o) => o.id === lead.origem_id)?.nome
  const motivoPerda = motivos.find((m) => m.id === lead.motivo_perda_id)?.nome
  const ativo = lead.etapa !== 'fechado' && lead.etapa !== 'perdido'
  const mostrarMvp = ativo && (lead.etapa === 'prospect' || pendentes.length === 0)
  const detalhes = [lead.empresa, nicho, lead.cidade].filter(Boolean).join(' · ')

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold break-words text-marinho">{lead.nome_contato}</h1>
            {detalhes && <p className="text-sm text-slate-600">{detalhes}</p>}
            <p className="text-sm text-slate-600">{formatarTelefone(lead.whatsapp)}</p>
            {lead.email && <p className="text-sm break-all text-slate-600">{lead.email}</p>}
          </div>
          <Link
            href={`/leads/${lead.id}/editar`}
            aria-label="Editar lead"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 focus-visible:outline-2 focus-visible:outline-azul"
          >
            <Pencil size={18} aria-hidden />
          </Link>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {lead.frio && <span className="rounded-full bg-azul/15 px-2 py-0.5 font-medium text-marinho">Frio</span>}
          {origem && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Origem: {origem}</span>}
          {lead.etapa === 'perdido' && motivoPerda && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Motivo: {motivoPerda}</span>
          )}
        </div>

        <div className="mt-3">
          <SeletorEtapa
            leadId={lead.id}
            etapa={lead.etapa}
            motivos={motivos.map((m) => ({ id: m.id, nome: m.nome }))}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={linkWhatsApp(lead.whatsapp, mensagem)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-laranja px-3 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
          >
            <MessageCircle size={18} aria-hidden /> WhatsApp
          </a>
          {lead.link_mvp ? (
            <a
              href={lead.link_mvp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-azul focus-visible:outline-2 focus-visible:outline-azul"
            >
              <ExternalLink size={16} aria-hidden /> Ver MVP
            </a>
          ) : (
            <span />
          )}
        </div>

        {lead.observacoes && <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">{lead.observacoes}</p>}
      </header>

      {mostrarMvp && <BotaoMvpEnviado leadId={lead.id} linkAtual={lead.link_mvp} />}

      <EditorRetornos
        leadId={lead.id}
        hoje={hoje}
        sequenciaPadrao={config.sequenciaPadrao}
        retornos={pendentes.map((r) => ({
          id: r.id,
          dataPrevista: r.data_prevista,
          ciclo: r.ciclo,
          rotuloOrigem: ROTULO_ORIGEM[r.origem] ?? r.origem,
        }))}
      />

      <TarefasDoLead
        leadId={lead.id}
        hoje={hoje}
        tarefas={tarefas.map((t) => ({ id: t.id, titulo: t.titulo, data: t.data, hora: t.hora }))}
      />

      <LinhaDoTempo
        leadId={lead.id}
        eventos={eventos.map((e) => ({ id: e.id, tipo: e.tipo, dados: e.dados, ocorridoEm: e.ocorrido_em }))}
      />
    </div>
  )
}
