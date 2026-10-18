'use client'

import { useState, useTransition } from 'react'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import { acaoConcluirTarefaDoLead } from '@/app/(app)/leads/actions'
import { acaoCriarTarefa } from '@/app/(app)/agenda/actions'

export interface TarefaLead {
  id: string
  titulo: string
  data: DataISO
  hora: string | null
}

interface Props {
  leadId: string
  hoje: DataISO
  tarefas: TarefaLead[]
}

export function TarefasDoLead({ leadId, hoje, tarefas }: Props) {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState<string>(hoje)
  const [hora, setHora] = useState('')

  function criar(e: React.FormEvent) {
    e.preventDefault()
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoCriarTarefa(titulo, data, hora, leadId)
      if (r.erro) setErro(r.erro)
      else {
        setTitulo('')
        setHora('')
        setAberto(false)
      }
    })
  }

  function concluir(id: string) {
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoConcluirTarefaDoLead(leadId, id)
      if (r.erro) setErro(r.erro)
    })
  }

  const campo =
    'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul'

  return (
    <section aria-labelledby="titulo-tarefas" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-tarefas" className="text-base font-semibold text-marinho">
          Tarefas do lead
        </h2>
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          className="min-h-11 rounded-lg border border-marinho px-3 text-sm font-medium text-marinho focus-visible:outline-2 focus-visible:outline-azul"
        >
          + Tarefa
        </button>
      </div>

      {tarefas.length === 0 && !aberto && <p className="mt-2 text-sm text-slate-600">Nenhuma tarefa pendente.</p>}

      {tarefas.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100">
          {tarefas.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-1">
              <button
                type="button"
                disabled={pendente}
                onClick={() => concluir(t.id)}
                aria-label={`Concluir tarefa: ${t.titulo}`}
                className="flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
              >
                <span className="block size-6 rounded-md border-2 border-slate-400" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800">{t.titulo}</p>
                <p className={`text-xs ${t.data < hoje ? 'text-laranja' : 'text-slate-500'}`}>
                  {formatarDataBR(t.data)}
                  {t.hora ? ` às ${t.hora.slice(0, 5)}` : ''}
                  {t.data < hoje ? ' · atrasada' : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <form onSubmit={criar} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="block text-sm text-slate-700">
            Título
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-slate-700">
              Data
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
            </label>
            <label className="block text-sm text-slate-700">
              Hora (opcional)
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pendente}
              onClick={() => setAberto(false)}
              className="min-h-11 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendente}
              className="min-h-11 rounded-lg bg-marinho text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
            >
              {pendente ? 'Salvando…' : 'Adicionar tarefa'}
            </button>
          </div>
        </form>
      )}

      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
    </section>
  )
}
