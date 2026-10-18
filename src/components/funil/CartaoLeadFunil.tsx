'use client'

import Link from 'next/link'
import { useDraggable } from '@dnd-kit/core'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import { ETAPAS, type Etapa } from '@/lib/dominio/tipos'
import type { LeadResumo } from '@/lib/servicos/tipos'

interface Props {
  lead: LeadResumo
  etapa: Etapa
  hoje: DataISO
  /** Quando informado, mostra o menu "Mover para…" (celular). */
  aoMover?: (nova: Etapa) => void
  desabilitado?: boolean
  arrastando?: boolean
}

export function CartaoLeadFunil({ lead, etapa, hoje, aoMover, desabilitado, arrastando }: Props) {
  const atrasado = lead.proximo_retorno !== null && lead.proximo_retorno < hoje
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${arrastando ? 'opacity-40' : ''}`}>
      <Link
        href={`/leads/${lead.id}`}
        draggable={false}
        className="block min-h-11 rounded-xl p-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-azul"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-marinho">{lead.nome_contato}</p>
            {lead.empresa && <p className="truncate text-sm text-slate-600">{lead.empresa}</p>}
          </div>
          {lead.frio && (
            <span className="shrink-0 rounded-full bg-azul/15 px-2 py-0.5 text-xs font-medium text-marinho">Frio</span>
          )}
        </div>
        <p className={`mt-1 text-sm ${atrasado ? 'font-medium text-laranja' : 'text-slate-500'}`}>
          {lead.proximo_retorno
            ? `Retorno: ${formatarDataBR(lead.proximo_retorno)}${atrasado ? ' (atrasado)' : ''}`
            : 'Sem retorno agendado'}
        </p>
      </Link>
      {aoMover && (
        <div className="border-t border-slate-100 p-2">
          <select
            aria-label={`Mover ${lead.nome_contato} para…`}
            value=""
            disabled={desabilitado}
            onChange={(e) => {
              if (e.target.value) aoMover(e.target.value as Etapa)
            }}
            className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-60"
          >
            <option value="">Mover para…</option>
            {ETAPAS.filter((e) => e.valor !== etapa).map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.rotulo}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

export function CartaoArrastavel(props: Omit<Props, 'aoMover' | 'arrastando'>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.lead.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <CartaoLeadFunil {...props} arrastando={isDragging} />
    </div>
  )
}
