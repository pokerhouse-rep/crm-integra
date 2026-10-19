'use client'

import { useState, useTransition, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { acaoMoverEtapa } from '@/app/(app)/leads/actions'
import { ETAPAS, type Etapa } from '@/lib/dominio/tipos'
import type { DataISO } from '@/lib/dominio/datas'
import { formatarValorNegociacao } from '@/lib/dominio/dinheiro'
import type { LeadResumo } from '@/lib/servicos/tipos'
import { DialogoMotivoPerda } from '@/components/leads/DialogoMotivoPerda'
import { CartaoArrastavel, CartaoLeadFunil } from './CartaoLeadFunil'

type Valor = { unicoCentavos: number; recorrenteCentavos: number }

interface Props {
  leads: LeadResumo[]
  hoje: DataISO
  valores: Record<string, Valor>
  motivos: { id: string; nome: string }[]
}

function Coluna({
  etapa,
  rotulo,
  total,
  soma,
  children,
}: {
  etapa: Etapa
  rotulo: string
  total: number
  soma: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa })
  return (
    <section
      ref={setNodeRef}
      aria-label={rotulo}
      className={`flex w-64 shrink-0 flex-col rounded-xl border p-2 ${
        isOver ? 'border-azul bg-azul/10' : 'border-slate-200 bg-slate-100'
      }`}
    >
      <h2 className="flex items-center justify-between px-1 text-sm font-semibold text-marinho">
        {rotulo}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700">{total}</span>
      </h2>
      <p className="mb-2 min-h-4 px-1 text-xs font-medium text-slate-600">{soma}</p>
      <div className="min-h-24 space-y-2">{children}</div>
    </section>
  )
}

export function QuadroFunil({ leads, hoje, valores, motivos }: Props) {
  // Etapa otimista por lead; removida quando a ação termina (sucesso: a página já revalidou; falha: volta ao original).
  const [otimista, setOtimista] = useState<Record<string, Etapa>>({})
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [pedindoMotivo, setPedindoMotivo] = useState<string | null>(null)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [abaMobile, setAbaMobile] = useState<Etapa>('prospect')

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const etapaDe = (l: LeadResumo): Etapa => otimista[l.id] ?? l.etapa
  const porEtapa = (e: Etapa) => leads.filter((l) => etapaDe(l) === e)
  // Perdido nunca soma (P12). A soma segue a etapa otimista.
  const somaDaEtapa = (e: Etapa): string => {
    if (e === 'perdido') return ''
    const total = porEtapa(e).reduce(
      (acc, l) => {
        const v = valores[l.id]
        return v
          ? { unicoCentavos: acc.unicoCentavos + v.unicoCentavos, recorrenteCentavos: acc.recorrenteCentavos + v.recorrenteCentavos }
          : acc
      },
      { unicoCentavos: 0, recorrenteCentavos: 0 },
    )
    return formatarValorNegociacao(total)
  }
  const arrastado = leads.find((l) => l.id === arrastandoId)

  function mover(leadId: string, nova: Etapa, motivoId?: string) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || etapaDe(lead) === nova) return
    setErro(null)
    setOtimista((o) => ({ ...o, [leadId]: nova }))
    iniciar(async () => {
      let r: { erro?: string }
      try {
        r = await acaoMoverEtapa(leadId, nova, motivoId)
      } catch {
        r = { erro: 'Não foi possível mover o lead. Tente novamente.' }
      }
      setOtimista((o) => {
        const resto = { ...o }
        delete resto[leadId]
        return resto
      })
      if (r.erro) setErro(r.erro)
      else setPedindoMotivo(null)
    })
  }

  function pedirMover(leadId: string, nova: Etapa) {
    if (nova === 'perdido') {
      const lead = leads.find((l) => l.id === leadId)
      if (!lead || etapaDe(lead) === 'perdido') return
      setErro(null)
      // o cartão só muda de coluna depois que o motivo for confirmado
      setPedindoMotivo(leadId)
    } else mover(leadId, nova)
  }

  function aoSoltar(ev: DragEndEvent) {
    setArrastandoId(null)
    if (!ev.over) return
    pedirMover(String(ev.active.id), ev.over.id as Etapa)
  }

  const abaAtual = ETAPAS.find((e) => e.valor === abaMobile) ?? ETAPAS[0]
  const leadsAba = porEtapa(abaAtual.valor)

  return (
    <div>
      {erro && !pedindoMotivo && (
        <p role="alert" className="mb-3 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}

      {/* Celular: abas por etapa */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Etapas do funil" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {ETAPAS.map((e) => {
            const ativa = e.valor === abaAtual.valor
            return (
              <button
                key={e.valor}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setAbaMobile(e.valor)}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-azul ${
                  ativa ? 'border-marinho bg-marinho text-white' : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                {e.rotulo}
                <span className={`rounded-full px-2 text-xs ${ativa ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {porEtapa(e.valor).length}
                </span>
              </button>
            )
          })}
        </div>
        <div role="tabpanel" className="mt-2 space-y-2">
          {somaDaEtapa(abaAtual.valor) && (
            <p className="text-sm font-medium text-slate-700">{somaDaEtapa(abaAtual.valor)}</p>
          )}
          {leadsAba.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              Nenhum lead em {abaAtual.rotulo}.
            </p>
          ) : (
            leadsAba.map((l) => (
              <CartaoLeadFunil
                key={l.id}
                lead={l}
                valor={valores[l.id]}
                etapa={etapaDe(l)}
                hoje={hoje}
                desabilitado={pendente}
                aoMover={(nova) => pedirMover(l.id, nova)}
              />
            ))
          )}
        </div>
      </div>

      {/* PC: uma coluna por etapa, com arrastar e soltar */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensores}
          onDragStart={(ev: DragStartEvent) => setArrastandoId(String(ev.active.id))}
          onDragEnd={aoSoltar}
          onDragCancel={() => setArrastandoId(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {ETAPAS.map((e) => {
              const lista = porEtapa(e.valor)
              return (
                <Coluna key={e.valor} etapa={e.valor} rotulo={e.rotulo} total={lista.length} soma={somaDaEtapa(e.valor)}>
                  {lista.map((l) => (
                    <CartaoArrastavel key={l.id} lead={l} valor={valores[l.id]} etapa={e.valor} hoje={hoje} />
                  ))}
                </Coluna>
              )
            })}
          </div>
          <DragOverlay>
            {arrastado && <CartaoLeadFunil lead={arrastado} valor={valores[arrastado.id]} etapa={etapaDe(arrastado)} hoje={hoje} />}
          </DragOverlay>
        </DndContext>
      </div>

      {pedindoMotivo && (
        <DialogoMotivoPerda
          titulo="Por que o lead foi perdido?"
          motivos={motivos}
          pendente={pendente}
          erro={erro ?? undefined}
          onConfirmar={(id) => mover(pedindoMotivo, 'perdido', id)}
          onCancelar={() => {
            setErro(null)
            setPedindoMotivo(null)
          }}
        />
      )}
    </div>
  )
}
