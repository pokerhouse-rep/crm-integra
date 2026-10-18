'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  motivos: { id: string; nome: string }[]
  pendente: boolean
  /** Erro de regra devolvido pela ação; aparece dentro do diálogo. */
  erro?: string
  titulo?: string
  onConfirmar: (motivoId: string) => void
  onCancelar: () => void
}

export function DialogoMotivoPerda({
  motivos,
  pendente,
  erro,
  titulo = 'Por que não tem interesse?',
  onConfirmar,
  onCancelar,
}: Props) {
  const [motivoId, setMotivoId] = useState('')
  const primeiroCampo = useRef<HTMLSelectElement>(null)
  const botaoCancelar = useRef<HTMLButtonElement>(null)
  const cancelarRef = useRef(onCancelar)
  const pendenteRef = useRef(pendente)
  useEffect(() => {
    cancelarRef.current = onCancelar
    pendenteRef.current = pendente
  })

  useEffect(() => {
    // foco na primeira opção (ou em Cancelar quando não há motivos)
    ;(primeiroCampo.current ?? botaoCancelar.current)?.focus()
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pendenteRef.current) cancelarRef.current()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [])

  return (
    <div
      className="fixed inset-0 z-30 flex items-end bg-black/40 md:items-center md:justify-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pendente) onCancelar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-motivo"
        className="w-full rounded-t-2xl bg-white p-4 pb-6 md:max-w-md md:rounded-2xl"
      >
        <h2 id="titulo-motivo" className="text-lg font-semibold text-marinho">
          {titulo}
        </h2>
        {motivos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nenhum motivo cadastrado. Cadastre em Configurações.</p>
        ) : (
          <label className="mt-3 block text-sm text-slate-700">
            Motivo da perda
            <select
              ref={primeiroCampo}
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
        {erro && (
          <p role="alert" className="mt-3 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
            {erro}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            ref={botaoCancelar}
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
