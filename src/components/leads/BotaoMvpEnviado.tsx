'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { acaoMarcarMvpEnviado } from '@/app/(app)/leads/actions'

interface Props {
  leadId: string
  linkAtual: string | null
}

export function BotaoMvpEnviado({ leadId, linkAtual }: Props) {
  const [aberto, setAberto] = useState(false)
  const [link, setLink] = useState(linkAtual ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoMarcarMvpEnviado(leadId, link)
      if (r.erro) setErro(r.erro)
      else setAberto(false)
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-laranja px-4 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
      >
        <Send size={18} aria-hidden /> Marcar MVP enviado
      </button>
    )
  }

  return (
    <form onSubmit={confirmar} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label htmlFor="mvp-link" className="block text-sm font-medium text-slate-700">
        Link do MVP
      </label>
      <input
        id="mvp-link"
        type="url"
        inputMode="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://"
        autoFocus
        className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul"
      />
      <p className="mt-1 text-xs text-slate-500">Os retornos da sequência padrão são criados a partir de hoje.</p>
      {erro && (
        <p role="alert" className="mt-2 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
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
          className="min-h-11 rounded-lg bg-laranja text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}
