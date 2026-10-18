import Link from 'next/link'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import { ETAPAS } from '@/lib/dominio/tipos'
import type { LeadResumo } from '@/lib/servicos/tipos'

const ROTULO_ETAPA = new Map<string, string>(ETAPAS.map((e) => [e.valor, e.rotulo]))

interface Props {
  leads: LeadResumo[]
  hoje: DataISO
}

export function ListaLeads({ leads, hoje }: Props) {
  return (
    <ul className="space-y-2">
      {leads.map((l) => {
        const atrasado = l.proximo_retorno !== null && l.proximo_retorno < hoje
        return (
          <li key={l.id}>
            <Link
              href={`/leads/${l.id}`}
              className="block min-h-11 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-azul"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-marinho">{l.nome_contato}</p>
                  {l.empresa && <p className="truncate text-sm text-slate-600">{l.empresa}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    {ROTULO_ETAPA.get(l.etapa) ?? l.etapa}
                  </span>
                  {l.frio && <span className="rounded-full bg-azul/15 px-2 py-0.5 font-medium text-marinho">Frio</span>}
                </div>
              </div>
              <p className={`mt-1 text-sm ${atrasado ? 'font-medium text-laranja' : 'text-slate-500'}`}>
                {l.proximo_retorno
                  ? `Próximo retorno: ${formatarDataBR(l.proximo_retorno)}${atrasado ? ' (atrasado)' : ''}`
                  : 'Sem retorno agendado'}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
