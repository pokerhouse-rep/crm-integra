'use client'

import { useState, useTransition, type ReactNode } from 'react'
import {
  ArrowRightLeft,
  Ban,
  Banknote,
  CheckCircle2,
  Circle,
  FileCheck,
  FileText,
  FileX,
  Pause,
  Pencil,
  PhoneCall,
  Play,
  Plus,
  RotateCcw,
  Send,
  Snowflake,
  StickyNote,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { descreverEvento } from '@/lib/dominio/eventos'
import { acaoAdicionarAnotacao } from '@/app/(app)/leads/actions'

export interface EventoLinha {
  id: string
  tipo: string
  dados: Record<string, unknown> | null
  ocorridoEm: string
}

function dataHora(iso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Araguaina',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
  return `${p('day')}/${p('month')}/${p('year')} ${p('hour')}:${p('minute')}`
}

const tam = 16

function iconeDoEvento(tipo: string): ReactNode {
  switch (tipo) {
    case 'criado': return <Plus size={tam} aria-hidden />
    case 'dados_editados': return <Pencil size={tam} aria-hidden />
    case 'anotacao': return <StickyNote size={tam} aria-hidden />
    case 'mvp_enviado': return <Send size={tam} aria-hidden />
    case 'retorno_feito': return <PhoneCall size={tam} aria-hidden />
    case 'etapa_alterada': return <ArrowRightLeft size={tam} aria-hidden />
    case 'frio': return <Snowflake size={tam} aria-hidden />
    case 'reativado': return <RotateCcw size={tam} aria-hidden />
    case 'tarefa_concluida': return <CheckCircle2 size={tam} aria-hidden />
    case 'proposta_criada':
    case 'proposta_enviada':
    case 'proposta_nova_versao': return <FileText size={tam} aria-hidden />
    case 'proposta_aceita': return <FileCheck size={tam} aria-hidden />
    case 'proposta_recusada': return <FileX size={tam} aria-hidden />
    case 'contrato_pausado': return <Pause size={tam} aria-hidden />
    case 'contrato_reativado': return <Play size={tam} aria-hidden />
    case 'contrato_cancelado': return <Ban size={tam} aria-hidden />
    case 'contrato_reajustado': return <TrendingUp size={tam} aria-hidden />
    case 'cobranca_paga': return <Banknote size={tam} aria-hidden />
    case 'pagamento_desfeito': return <Undo2 size={tam} aria-hidden />
    default: return <Circle size={tam} aria-hidden />
  }
}

export function LinhaDoTempo({ leadId, eventos }: { leadId: string; eventos: EventoLinha[] }) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoAdicionarAnotacao(leadId, texto)
      if (r.erro) setErro(r.erro)
      else setTexto('')
    })
  }

  return (
    <section aria-labelledby="titulo-timeline" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="titulo-timeline" className="text-base font-semibold text-marinho">
        Histórico
      </h2>

      <form onSubmit={enviar} className="mt-3">
        <label htmlFor="nova-anotacao" className="block text-sm font-medium text-slate-700">
          Adicionar anotação
        </label>
        <textarea
          id="nova-anotacao"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-azul"
        />
        {erro && (
          <p role="alert" className="mt-2 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={pendente || !texto.trim()}
          className="mt-2 min-h-11 rounded-lg bg-marinho px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Salvar anotação'}
        </button>
      </form>

      <ol className="mt-4 space-y-3">
        {eventos.map((ev) => {
          const { texto: t, detalhe } = descreverEvento(ev.tipo, ev.dados)
          const icone = iconeDoEvento(ev.tipo)
          return (
            <li key={ev.id} className="flex gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-marinho">
                {icone}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-slate-800">{t}</p>
                {detalhe && <p className="text-sm break-words whitespace-pre-wrap text-slate-600">{detalhe}</p>}
                <p className="text-xs text-slate-500">{dataHora(ev.ocorridoEm)}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
