import Link from 'next/link'
import { ETAPAS } from '@/lib/dominio/tipos'
import { formatarTelefone } from '@/lib/dominio/telefone'
import { listarLeads } from '@/lib/servicos/leads'
import { criarClienteServidor } from '@/lib/supabase/server'

export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q: bruto } = await searchParams
  const q = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim() ?? ''
  const leads = q ? await listarLeads(await criarClienteServidor(), { busca: q }) : []
  const rotuloEtapa = (v: string) => ETAPAS.find((e) => e.valor === v)?.rotulo ?? v

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-marinho">Busca</h1>
      {!q ? (
        <p className="text-slate-600">Digite um nome, empresa ou telefone no campo acima.</p>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="mb-4 text-slate-600">Nenhum lead encontrado para “{q}”.</p>
          <Link href="/leads/novo" className="inline-flex min-h-11 items-center rounded-lg bg-laranja px-4 font-semibold text-white">
            + Lead
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {leads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/leads/${l.id}`}
                className="flex min-h-11 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm focus-visible:outline-2 focus-visible:outline-azul"
              >
                <span className="font-semibold text-marinho">{l.nome_contato}</span>
                {l.empresa && <span className="text-sm text-slate-600">{l.empresa}</span>}
                <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  {formatarTelefone(l.whatsapp)}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{rotuloEtapa(l.etapa)}</span>
                  {l.frio && <span className="rounded-full bg-azul/20 px-2 py-0.5 text-xs text-marinho">Frio</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
