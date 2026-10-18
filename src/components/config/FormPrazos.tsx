'use client'

import { useState, useTransition } from 'react'
import { acaoSalvarPrazos } from '@/app/(app)/config/actions'

const campo =
  'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul'

export function FormPrazos({ sequencia, diasReativacao }: { sequencia: number[]; diasReativacao: number }) {
  const [seq, setSeq] = useState(sequencia.join(', '))
  const [dias, setDias] = useState(String(diasReativacao))
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (pendente) return
    setErro(null)
    setOk(false)
    iniciar(async () => {
      const r = await acaoSalvarPrazos(seq, dias)
      if (r.erro) setErro(r.erro)
      else setOk(true)
    })
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <label className="block text-sm text-slate-700">
        Sequência padrão de retornos (dias após o envio do MVP)
        <input type="text" inputMode="numeric" value={seq} onChange={(e) => setSeq(e.target.value)} className={campo} />
        <span className="mt-1 block text-xs text-slate-500">Números separados por vírgula, em ordem crescente. Ex.: 2, 5, 10</span>
      </label>
      <label className="block text-sm text-slate-700">
        Reativação de leads frios (dias)
        <input type="text" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} className={campo} />
        <span className="mt-1 block text-xs text-slate-500">Entre 1 e 365.</span>
      </label>
      {erro && (
        <p role="alert" className="rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
      {ok && (
        <p role="status" className="text-sm text-marinho">
          Prazos salvos.
        </p>
      )}
      <button
        type="submit"
        disabled={pendente}
        className="min-h-11 rounded-lg bg-marinho px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
      >
        {pendente ? 'Salvando…' : 'Salvar prazos'}
      </button>
    </form>
  )
}
