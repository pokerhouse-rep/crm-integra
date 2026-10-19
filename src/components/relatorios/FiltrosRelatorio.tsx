'use client'

import { useRouter } from 'next/navigation'
import { PERIODOS, type ChavePeriodo } from '@/lib/dominio/periodo'

interface Props {
  periodo: ChavePeriodo
  de: string
  ate: string
  nichoId: string
  origemId: string
  nichos: { id: string; nome: string }[]
  origens: { id: string; nome: string }[]
}

const CAMPO =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-azul'

export function FiltrosRelatorio({ periodo, de, ate, nichoId, origemId, nichos, origens }: Props) {
  const router = useRouter()

  function aplicar(novo: Partial<Record<'periodo' | 'de' | 'ate' | 'nicho' | 'origem', string>>) {
    const v = { periodo, de, ate, nicho: nichoId, origem: origemId, ...novo }
    const p = new URLSearchParams()
    if (v.periodo !== 'mes') p.set('periodo', v.periodo)
    if (v.periodo === 'personalizado') {
      if (v.de) p.set('de', v.de)
      if (v.ate) p.set('ate', v.ate)
    }
    if (v.nicho) p.set('nicho', v.nicho)
    if (v.origem) p.set('origem', v.origem)
    const qs = p.toString()
    router.replace(qs ? `/relatorios?${qs}` : '/relatorios')
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block text-sm font-medium text-slate-700">
        Período
        <select className={`${CAMPO} mt-1`} value={periodo} onChange={(e) => aplicar({ periodo: e.target.value })}>
          {PERIODOS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </label>
      {periodo === 'personalizado' && (
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-2">
          <label className="block text-sm font-medium text-slate-700">
            De
            <input
              type="date"
              className={`${CAMPO} mt-1`}
              defaultValue={de}
              onChange={(e) => e.target.value && aplicar({ de: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Até
            <input
              type="date"
              className={`${CAMPO} mt-1`}
              defaultValue={ate}
              onChange={(e) => e.target.value && aplicar({ ate: e.target.value })}
            />
          </label>
        </div>
      )}
      <label className="block text-sm font-medium text-slate-700">
        Nicho
        <select className={`${CAMPO} mt-1`} value={nichoId} onChange={(e) => aplicar({ nicho: e.target.value })}>
          <option value="">Todos</option>
          {nichos.map((n) => (
            <option key={n.id} value={n.id}>
              {n.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Origem
        <select className={`${CAMPO} mt-1`} value={origemId} onChange={(e) => aplicar({ origem: e.target.value })}>
          <option value="">Todas</option>
          {origens.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
