'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import { acaoConcluirTarefa, acaoReagendarTarefa } from '@/app/(app)/hoje/actions'
import { SeletorNovaData } from './SeletorNovaData'

export interface DadosCartaoTarefa {
  id: string
  titulo: string
  data: DataISO
  hora: string | null
  atrasado: boolean
  lead: { id: string; nome: string } | null
}

const botao =
  'flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'

export function CartaoTarefa({ dados, hoje }: { dados: DadosCartaoTarefa; hoje: DataISO }) {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [reagendando, setReagendando] = useState(false)

  function rodar(fn: () => Promise<{ erro?: string }>) {
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if (r.erro) setErro(r.erro)
      else setReagendando(false)
    })
  }

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${dados.atrasado ? 'border-laranja' : 'border-slate-200'} ${pendente ? 'opacity-70' : ''}`}
      aria-busy={pendente}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-semibold text-marinho">{dados.titulo}</p>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            Tarefa{dados.hora ? ` · ${dados.hora.slice(0, 5)}` : ''}
          </span>
          {dados.atrasado && (
            <span className="rounded-full bg-laranja/15 px-2 py-0.5 font-medium text-laranja">
              Atrasado · {formatarDataBR(dados.data).slice(0, 5)}
            </span>
          )}
        </div>
      </div>
      {dados.lead && (
        <Link href={`/leads/${dados.lead.id}`} className="mt-1 inline-flex min-h-11 items-center text-sm text-azul underline">
          {dados.lead.nome}
        </Link>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pendente}
          onClick={() => rodar(() => acaoConcluirTarefa(dados.id))}
          className={`${botao} bg-marinho text-white`}
        >
          <Check size={18} aria-hidden /> Concluir
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => setReagendando((v) => !v)}
          className={`${botao} border border-slate-300 text-slate-700`}
        >
          Reagendar
        </button>
      </div>
      {reagendando && (
        <SeletorNovaData
          hoje={hoje}
          pendente={pendente}
          onEscolher={(data) => rodar(() => acaoReagendarTarefa(dados.id, data, dados.hora))}
          onCancelar={() => setReagendando(false)}
        />
      )}
      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
    </article>
  )
}
