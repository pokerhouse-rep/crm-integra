'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { formatarReais, formatarValorNegociacao } from '@/lib/dominio/dinheiro'
import type { StatusProposta } from '@/lib/dominio/tipos'
import { acaoCriarProposta } from '@/app/(app)/leads/[id]/propostas/actions'
import { COR_STATUS_PROPOSTA, ROTULO_STATUS_PROPOSTA } from './rotulos'

export interface PropostaLinha {
  id: string
  titulo: string
  versao: number
  status: StatusProposta
  unicoCentavos: number
  recorrenteCentavos: number
}

export function ListaPropostasDoLead({ leadId, propostas }: { leadId: string; propostas: PropostaLinha[] }) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function criar() {
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoCriarProposta(leadId)
      if (r?.erro) setErro(r.erro)
    })
  }

  return (
    <section aria-labelledby="titulo-propostas" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-propostas" className="text-base font-semibold text-marinho">
          Propostas
        </h2>
        <button
          type="button"
          onClick={criar}
          disabled={pendente}
          className="flex min-h-11 items-center gap-1 rounded-lg bg-laranja px-3 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
        >
          <Plus size={16} aria-hidden /> {pendente ? 'Criando…' : 'Nova proposta'}
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
      {propostas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Nenhuma proposta ainda. Crie a primeira quando o lead pedir valores.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {propostas.map((p) => (
            <li key={p.id}>
              <Link
                href={`/leads/${leadId}/propostas/${p.id}`}
                className="block min-h-11 rounded-lg border border-slate-200 p-3 focus-visible:outline-2 focus-visible:outline-azul"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-medium break-words text-slate-800">
                    {p.titulo} <span className="font-normal text-slate-500">v{p.versao}</span>
                  </p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COR_STATUS_PROPOSTA[p.status]}`}>
                    {ROTULO_STATUS_PROPOSTA[p.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{formatarValorNegociacao(p) || formatarReais(0)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
