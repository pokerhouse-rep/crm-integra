'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { reaisParaCampo } from '@/lib/dominio/dinheiro'
import { acaoReajustar } from '@/app/(app)/clientes/actions'

interface Props {
  itemId: string
  valorVigenteCentavos: number
  /** Mês seguinte ao de hoje, 'YYYY-MM'. */
  mesPadrao: string
}

export function FormReajuste({ itemId, valorVigenteCentavos, mesPadrao }: Props) {
  const id = useId()
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState(reaisParaCampo(valorVigenteCentavos))
  const [mes, setMes] = useState(mesPadrao)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const ocupado = useRef(false)

  function salvar() {
    if (ocupado.current) return
    ocupado.current = true
    setErro(null)
    iniciar(async () => {
      try {
        const r = await acaoReajustar(itemId, valor, mes)
        if (r.erro) setErro(r.erro)
        else setAberto(false)
      } finally {
        ocupado.current = false
      }
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setValor(reaisParaCampo(valorVigenteCentavos))
          setMes(mesPadrao)
          setErro(null)
          setAberto(true)
        }}
        className="mt-2 min-h-11 rounded-lg border border-marinho px-3 text-sm font-medium text-marinho focus-visible:outline-2 focus-visible:outline-azul"
      >
        Reajustar mensalidade
      </button>
    )
  }
  return (
    <div className="mt-2 space-y-3 rounded-lg bg-slate-50 p-3">
      <label htmlFor={`${id}-v`} className="block text-sm text-slate-700">
        Novo valor mensal (R$)
        <input
          id={`${id}-v`}
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
        />
      </label>
      <label htmlFor={`${id}-m`} className="block text-sm text-slate-700">
        A partir de
        <input
          id={`${id}-m`}
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
        />
      </label>
      <p className="text-xs text-slate-600">
        Vale para as mensalidades abertas desse mês em diante e para as próximas geradas. Mensalidades pagas não mudam.
      </p>
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pendente}
          onClick={salvar}
          className="min-h-11 rounded-lg bg-marinho text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
        >
          Salvar reajuste
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => setAberto(false)}
          className="min-h-11 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
