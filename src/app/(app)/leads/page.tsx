import Link from 'next/link'
import { hojeEmPalmas } from '@/lib/dominio/datas'
import { ETAPAS, type Etapa } from '@/lib/dominio/tipos'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarOpcoes } from '@/lib/servicos/config'
import { listarLeads, type FiltrosLeads } from '@/lib/servicos/leads'
import { ListaLeads } from '@/components/leads/ListaLeads'

export const dynamic = 'force-dynamic'

type Params = Record<string, string | string[] | undefined>

function um(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  return s ? s : undefined
}

const campo =
  'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-azul'

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams
  const etapa = ETAPAS.find((e) => e.valor === um(p.etapa))?.valor as Etapa | undefined
  const db = await criarClienteServidor()
  const [nichos, origens] = await Promise.all([listarOpcoes(db, 'nicho'), listarOpcoes(db, 'origem')])
  const nichoId = nichos.find((n) => n.id === um(p.nicho))?.id
  const origemId = origens.find((o) => o.id === um(p.origem))?.id
  const frio = um(p.frio) === '1'

  const filtros: FiltrosLeads = { etapa, nichoId, origemId, frio: frio ? true : undefined }
  const leads = await listarLeads(db, filtros)
  const filtrando = Boolean(etapa || nichoId || origemId || frio)

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-marinho">Leads</h1>
        <Link
          href="/leads/novo"
          className="flex min-h-11 items-center rounded-lg bg-laranja px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
        >
          + Novo lead
        </Link>
      </header>

      <form method="get" className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Filtros">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-slate-700">
            Etapa
            <select name="etapa" defaultValue={etapa ?? ''} className={campo}>
              <option value="">Todas</option>
              {ETAPAS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Nicho
            <select name="nicho" defaultValue={nichoId ?? ''} className={campo}>
              <option value="">Todos</option>
              {nichos.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Origem
            <select name="origem" defaultValue={origemId ?? ''} className={campo}>
              <option value="">Todas</option>
              {origens.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 self-end text-sm text-slate-700">
            <input type="checkbox" name="frio" value="1" defaultChecked={frio} className="size-5" />
            Só frios
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-marinho px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
          >
            Filtrar
          </button>
          {filtrando && (
            <Link
              href="/leads"
              className="flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-azul"
            >
              Limpar filtros
            </Link>
          )}
        </div>
      </form>

      <p className="mb-2 text-sm text-slate-600">
        {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
      </p>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-700">
            {filtrando ? 'Nenhum lead com esses filtros.' : 'Você ainda não cadastrou nenhum lead.'}
          </p>
          <Link
            href="/leads/novo"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-laranja px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
          >
            Cadastrar lead
          </Link>
        </div>
      ) : (
        <ListaLeads leads={leads} hoje={hojeEmPalmas()} />
      )}
    </div>
  )
}
