import Link from 'next/link'
import { hojeEmPalmas } from '@/lib/dominio/datas'
import { formatarReais } from '@/lib/dominio/dinheiro'
import type { StatusContrato } from '@/lib/dominio/tipos'
import { criarClienteServidor } from '@/lib/supabase/server'
import { garantirMensalidades } from '@/lib/servicos/cobrancas'
import { listarContratos, mrrAtivo } from '@/lib/servicos/contratos'
import { CartaoContrato } from '@/components/clientes/CartaoContrato'

export const dynamic = 'force-dynamic'

const FILTROS = [
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'pausado', rotulo: 'Pausados' },
  { valor: 'cancelado', rotulo: 'Cancelados' },
  { valor: 'todos', rotulo: 'Todos' },
] as const

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const { situacao } = await searchParams
  const filtro = FILTROS.find((f) => f.valor === situacao)?.valor ?? 'ativo'
  const db = await criarClienteServidor()
  const hoje = hojeEmPalmas()
  await garantirMensalidades(db, hoje)
  // MRR sempre dos ativos, independente do filtro da lista.
  const todos = await listarContratos(db, hoje)
  const mrr = mrrAtivo(todos)
  const contratos = filtro === 'todos' ? todos : todos.filter((c) => c.status === (filtro as StatusContrato))

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-marinho">Clientes</h1>
        <p className="text-sm text-slate-600">
          MRR ativo: <strong className="text-base text-marinho">{formatarReais(mrr)}</strong>/mês
        </p>
        <Link
          href="/clientes/cobrancas"
          className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-laranja px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
        >
          Cobranças do mês
        </Link>
      </header>

      <nav aria-label="Filtrar por situação" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={f.valor === 'ativo' ? '/clientes' : `/clientes?situacao=${f.valor}`}
            aria-current={filtro === f.valor ? 'true' : undefined}
            className={`flex min-h-11 items-center rounded-full border px-4 text-sm focus-visible:outline-2 focus-visible:outline-azul ${
              filtro === f.valor ? 'border-marinho bg-marinho font-medium text-white' : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {f.rotulo}
          </Link>
        ))}
      </nav>

      {contratos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-700">Nenhum contrato nesta situação. Quando uma proposta for aceita, o contrato aparece aqui.</p>
          <Link
            href="/leads"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-laranja px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
          >
            Ver leads
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {contratos.map((c) => (
            <CartaoContrato key={c.id} contrato={c} />
          ))}
        </div>
      )}
    </div>
  )
}
