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
import { formatarDataBR } from '@/lib/dominio/datas'
import { formatarReais, formatarValorNegociacao } from '@/lib/dominio/dinheiro'
import { ETAPAS } from '@/lib/dominio/tipos'
import { acaoAdicionarAnotacao } from '@/app/(app)/leads/actions'

export interface EventoLinha {
  id: string
  tipo: string
  dados: Record<string, unknown> | null
  ocorridoEm: string
}

const ROTULO_ETAPA = new Map<string, string>(ETAPAS.map((e) => [e.valor, e.rotulo]))

const ROTULO_RESULTADO: Record<string, string> = {
  respondeu: 'Respondeu',
  pediu_tempo: 'Pediu tempo',
  sem_interesse: 'Sem interesse',
  sem_resposta: 'Sem resposta',
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

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function descrever(e: EventoLinha): { icone: ReactNode; texto: string; detalhe?: string } {
  const d = e.dados ?? {}
  const tam = 16
  switch (e.tipo) {
    case 'criado':
      return { icone: <Plus size={tam} aria-hidden />, texto: 'Lead cadastrado' }
    case 'dados_editados':
      return { icone: <Pencil size={tam} aria-hidden />, texto: 'Dados do lead editados' }
    case 'anotacao':
      return { icone: <StickyNote size={tam} aria-hidden />, texto: 'Anotação', detalhe: str(d.texto) ?? undefined }
    case 'mvp_enviado':
      return {
        icone: <Send size={tam} aria-hidden />,
        texto: 'MVP enviado',
        detalhe: str(d.link) ?? undefined,
      }
    case 'retorno_feito': {
      const res = ROTULO_RESULTADO[str(d.resultado) ?? ''] ?? 'Resultado registrado'
      const nova = str(d.nova_data)
      return {
        icone: <PhoneCall size={tam} aria-hidden />,
        texto: `Retorno feito: ${res}`,
        detalhe: nova ? `Nova data: ${formatarDataBR(nova)}` : undefined,
      }
    }
    case 'etapa_alterada': {
      const de = ROTULO_ETAPA.get(str(d.de) ?? '') ?? str(d.de) ?? '?'
      const para = ROTULO_ETAPA.get(str(d.para) ?? '') ?? str(d.para) ?? '?'
      return { icone: <ArrowRightLeft size={tam} aria-hidden />, texto: `Etapa: ${de} → ${para}` }
    }
    case 'frio':
      return { icone: <Snowflake size={tam} aria-hidden />, texto: 'Lead ficou frio (sem resposta na sequência)' }
    case 'reativado':
      return { icone: <RotateCcw size={tam} aria-hidden />, texto: 'Lead reativado: voltou a responder' }
    case 'tarefa_concluida':
      return {
        icone: <CheckCircle2 size={tam} aria-hidden />,
        texto: 'Tarefa concluída',
        detalhe: str(d.titulo) ?? undefined,
      }
    case 'proposta_criada':
      return { icone: <FileText size={tam} aria-hidden />, texto: 'Proposta criada' }
    case 'proposta_enviada': {
      const v = num(d.versao)
      const valor = formatarValorNegociacao({
        unicoCentavos: num(d.total_unico) ?? 0,
        recorrenteCentavos: num(d.total_recorrente) ?? 0,
      })
      const partes = [v !== null ? `v${v}` : null, valor || null].filter(Boolean)
      return {
        icone: <FileText size={tam} aria-hidden />,
        texto: `Proposta enviada${partes.length ? ` (${partes.join(' · ')})` : ''}`,
      }
    }
    case 'proposta_nova_versao': {
      const v = num(d.versao)
      return { icone: <FileText size={tam} aria-hidden />, texto: `Nova versão da proposta${v !== null ? ` (v${v})` : ''}` }
    }
    case 'proposta_aceita':
      return { icone: <FileCheck size={tam} aria-hidden />, texto: 'Proposta aceita' }
    case 'proposta_recusada':
      return { icone: <FileX size={tam} aria-hidden />, texto: 'Proposta recusada' }
    case 'contrato_pausado':
      return { icone: <Pause size={tam} aria-hidden />, texto: 'Contrato pausado' }
    case 'contrato_reativado':
      return { icone: <Play size={tam} aria-hidden />, texto: 'Contrato reativado' }
    case 'contrato_cancelado':
      return { icone: <Ban size={tam} aria-hidden />, texto: 'Contrato cancelado' }
    case 'contrato_reajustado': {
      const valor = num(d.valor)
      const de = str(d.a_partir_de)
      const quando = de ? ` a partir de ${de.slice(5, 7)}/${de.slice(0, 4)}` : ''
      return {
        icone: <TrendingUp size={tam} aria-hidden />,
        texto: `Mensalidade reajustada${valor !== null ? ` para ${formatarReais(valor)}` : ''}${quando}`,
      }
    }
    case 'cobranca_paga': {
      const valor = num(d.valor)
      return {
        icone: <Banknote size={tam} aria-hidden />,
        texto: valor !== null ? `Pagamento registrado: ${formatarReais(valor)}` : 'Pagamento registrado',
      }
    }
    case 'pagamento_desfeito':
      return { icone: <Undo2 size={tam} aria-hidden />, texto: 'Pagamento desfeito' }
    default:
      return { icone: <Circle size={tam} aria-hidden />, texto: e.tipo.replaceAll('_', ' ') }
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
          const { icone, texto: t, detalhe } = descrever(ev)
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
