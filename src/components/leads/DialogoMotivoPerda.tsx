'use client'

import { useState } from 'react'

interface Props {
  motivos: { id: string; nome: string }[]
  pendente: boolean
  onConfirmar: (motivoId: string) => void
  onCancelar: () => void
}

export function DialogoMotivoPerda({ motivos, pendente, onConfirmar, onCancelar }: Props) {
  const [motivoId, setMotivoId] = useState('')
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40 md:items-center md:justify-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-motivo"
        className="w-full rounded-t-2xl bg-white p-4 pb-6 md:max-w-md md:rounded-2xl"
      >
        <h2 id="titulo-motivo" className="text-lg font-semibold text-marinho">
          Por que não tem interesse?
        </h2>
        {motivos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nenhum motivo cadastrado. Cadastre em Configurações.</p>
        ) : (
          <label className="mt-3 block text-sm text-slate-700">
            Motivo da perda
            <select
              value={motivoId}
              onChange={(e) => setMotivoId(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            >
              <option value="">Selecione…</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={pendente}
            className="min-h-11 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pendente || !motivoId}
            onClick={() => onConfirmar(motivoId)}
            className="min-h-11 rounded-lg bg-marinho text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-50"
          >
            Marcar como perdido
          </button>
        </div>
      </div>
    </div>
  )
}
