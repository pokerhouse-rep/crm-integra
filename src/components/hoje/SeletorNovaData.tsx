'use client'

import { useState } from 'react'
import { agendarPrazo, formatarDataBR, type DataISO } from '@/lib/dominio/datas'

interface Props {
  hoje: DataISO
  pendente: boolean
  onEscolher: (data: DataISO) => void
  onCancelar: () => void
}

const ATALHOS = [
  { rotulo: '+3 dias', dias: 3 },
  { rotulo: '+1 semana', dias: 7 },
  { rotulo: '+1 mês', dias: 30 },
]

export function SeletorNovaData({ hoje, pendente, onEscolher, onCancelar }: Props) {
  const [livre, setLivre] = useState('')
  const botao =
    'min-h-11 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-1 text-sm font-medium text-marinho hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50'

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" role="group" aria-label="Escolher nova data">
      <p className="mb-2 text-sm font-medium text-slate-700">Nova data</p>
      <div className="grid grid-cols-3 gap-2">
        {ATALHOS.map((a) => {
          const data = agendarPrazo(hoje, a.dias)
          return (
            <button key={a.dias} type="button" disabled={pendente} onClick={() => onEscolher(data)} className={botao}>
              <span className="block">{a.rotulo}</span>
              <span className="block text-xs font-normal text-slate-500">{formatarDataBR(data).slice(0, 5)}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <label className="flex-1 text-sm text-slate-700">
          Outra data
          <input
            type="date"
            min={hoje}
            value={livre}
            onChange={(e) => setLivre(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
          />
        </label>
        <button
          type="button"
          disabled={pendente || !livre || livre < hoje}
          onClick={() => onEscolher(livre)}
          className="min-h-11 rounded-lg bg-marinho px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
        >
          Confirmar
        </button>
      </div>
      <button type="button" onClick={onCancelar} disabled={pendente} className="mt-2 min-h-11 text-sm text-slate-600 underline">
        Cancelar
      </button>
    </div>
  )
}
