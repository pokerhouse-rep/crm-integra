'use client'

import { useRef, useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import type { DataISO } from '@/lib/dominio/datas'
import { acaoBuscarLeads, acaoCriarTarefa } from '@/app/(app)/agenda/actions'

type LeadOpcao = { id: string; nome: string; empresa: string | null }

const campo =
  'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul'

export function FormTarefa({ hoje }: { hoje: DataISO }) {
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState<string>(hoje)
  const [hora, setHora] = useState('')
  const [busca, setBusca] = useState('')
  const [opcoes, setOpcoes] = useState<LeadOpcao[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [lead, setLead] = useState<LeadOpcao | null>(null)
  const ultimaBusca = useRef('')

  async function procurar(texto: string) {
    setBusca(texto)
    ultimaBusca.current = texto
    if (texto.trim().length < 2) {
      setOpcoes(null)
      setBuscando(false)
      return
    }
    setBuscando(true)
    try {
      const r = await acaoBuscarLeads(texto)
      if (ultimaBusca.current === texto) {
        setOpcoes(r) // ignora respostas de buscas antigas
        setBuscando(false)
      }
    } catch {
      if (ultimaBusca.current === texto) setBuscando(false)
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoCriarTarefa(titulo, data, hora, lead?.id ?? null)
      if (r.erro) {
        setErro(r.erro)
        return
      }
      setTitulo('')
      setHora('')
      setBusca('')
      setOpcoes(null)
      setLead(null)
      setAberto(false)
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-laranja px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
      >
        <Plus size={18} aria-hidden /> Tarefa
      </button>
    )
  }

  return (
    <form onSubmit={enviar} className="w-full space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:max-w-xl">
      <label className="block text-sm text-slate-700">
        Título *
        <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm text-slate-700">
          Data *
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
        </label>
        <label className="block text-sm text-slate-700">
          Hora (opcional)
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
        </label>
      </div>

      {lead ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1 text-sm">
          <span className="min-w-0 truncate">
            Lead: <strong className="text-marinho">{lead.nome}</strong>
            {lead.empresa ? ` · ${lead.empresa}` : ''}
          </span>
          <button
            type="button"
            onClick={() => setLead(null)}
            aria-label="Remover lead da tarefa"
            className="flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-azul"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      ) : (
        <div className="text-sm text-slate-700">
          <label>
            Lead (opcional)
            <input
              type="search"
              value={busca}
              onChange={(e) => void procurar(e.target.value)}
              placeholder="Buscar lead por nome"
              className={campo}
            />
          </label>
          {buscando && <p className="mt-1 text-xs text-slate-500">Buscando…</p>}
          {opcoes && !buscando && opcoes.length === 0 && <p className="mt-1 text-xs text-slate-500">Nenhum lead encontrado.</p>}
          {opcoes && opcoes.length > 0 && (
            <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {opcoes.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setLead(o)
                      setOpcoes(null)
                      setBusca('')
                    }}
                    className="flex min-h-11 w-full flex-col justify-center px-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-azul"
                  >
                    <span className="text-sm text-marinho">{o.nome}</span>
                    {o.empresa && <span className="text-xs text-slate-500">{o.empresa}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {erro && (
        <p role="alert" className="rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
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
  )
}
