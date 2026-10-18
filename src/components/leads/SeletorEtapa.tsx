'use client'

import { useState, useTransition } from 'react'
import { ETAPAS, type Etapa } from '@/lib/dominio/tipos'
import { acaoMoverEtapa } from '@/app/(app)/leads/actions'
import { DialogoMotivoPerda } from './DialogoMotivoPerda'

interface Props {
  leadId: string
  etapa: Etapa
  motivos: { id: string; nome: string }[]
}

export function SeletorEtapa({ leadId, etapa, motivos }: Props) {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [pedindoMotivo, setPedindoMotivo] = useState(false)

  function mover(nova: Etapa, motivoId?: string) {
    if (pendente) return
    setErro(null)
    iniciar(async () => {
      const r = await acaoMoverEtapa(leadId, nova, motivoId)
      if (r.erro) setErro(r.erro)
      else setPedindoMotivo(false)
    })
  }

  return (
    <div>
      <label htmlFor="seletor-etapa" className="block text-sm font-medium text-slate-700">
        Etapa
      </label>
      <select
        id="seletor-etapa"
        value={etapa}
        disabled={pendente}
        onChange={(e) => {
          const nova = e.target.value as Etapa
          if (nova === 'perdido') {
            setErro(null)
            setPedindoMotivo(true)
          } else mover(nova)
        }}
        className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul disabled:opacity-60"
      >
        {ETAPAS.map((e) => (
          <option key={e.valor} value={e.valor}>
            {e.rotulo}
          </option>
        ))}
      </select>
      {erro && !pedindoMotivo && (
        <p role="alert" className="mt-2 rounded-lg bg-laranja/10 p-2 text-sm text-laranja">
          {erro}
        </p>
      )}
      {pedindoMotivo && (
        <DialogoMotivoPerda
          titulo="Por que o lead foi perdido?"
          motivos={motivos}
          pendente={pendente}
          erro={erro ?? undefined}
          onConfirmar={(id) => mover('perdido', id)}
          onCancelar={() => setPedindoMotivo(false)}
        />
      )}
    </div>
  )
}
