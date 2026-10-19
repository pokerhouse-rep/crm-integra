import Link from 'next/link'
import { competenciaDe, resumirMes, somarMeses } from '@/lib/dominio/cobrancas'
import { hojeEmPalmas } from '@/lib/dominio/datas'
import { formatarReais } from '@/lib/dominio/dinheiro'
import { criarClienteServidor } from '@/lib/supabase/server'
import { garantirMensalidades, listarCobrancas } from '@/lib/servicos/cobrancas'
import { obterConfig } from '@/lib/servicos/config'
import { CartaoCobranca } from '@/components/cobrancas/CartaoCobranca'

export const dynamic = 'force-dynamic'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export default async function CobrancasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; atrasadas?: string }>
}) {
  const { mes: mesParam, atrasadas: atrasadasParam } = await searchParams
  const db = await criarClienteServidor()
  const hoje = hojeEmPalmas()
  const atrasadas = atrasadasParam === '1'
  const mes = mesParam && /^20\d{2}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : hoje.slice(0, 7)
  await garantirMensalidades(db, hoje)
  const [config, cobrancas] = await Promise.all([
    obterConfig(db),
    listarCobrancas(db, atrasadas ? { atrasadas: true } : { mes }, hoje),
  ])
  const total = resumirMes(
    cobrancas.map((c) => ({
      status: c.status,
      valorCentavos: c.valor_centavos,
      valorPagoCentavos: c.valor_pago_centavos,
    })),
  )
  const base = `${mes}-01`
  const anterior = competenciaDe(somarMeses(base, -1)).slice(0, 7)
  const proximo = competenciaDe(somarMeses(base, 1)).slice(0, 7)
  const nomeMes = MESES[Number(mes.slice(5, 7)) - 1]
  const titulo = `${nomeMes[0].toUpperCase()}${nomeMes.slice(1)} de ${mes.slice(0, 4)}`
  const link = 'flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-azul'

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4">
        <Link href="/clientes" className="inline-flex min-h-11 items-center text-sm text-azul underline">
          ‹ Clientes
        </Link>
        <h1 className="text-xl font-semibold text-marinho">{atrasadas ? 'Cobranças atrasadas' : `Cobranças com vencimento em ${mes.slice(5, 7)}/${mes.slice(0, 4)}`}</h1>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!atrasadas && (
          <>
            <Link href={`/clientes/cobrancas?mes=${anterior}`} className={link}>
              ‹ Mês anterior
            </Link>
            <span className="px-1 text-sm font-medium text-marinho">{titulo}</span>
            <Link href={`/clientes/cobrancas?mes=${proximo}`} className={link}>
              Próximo ›
            </Link>
          </>
        )}
        <Link
          href={atrasadas ? `/clientes/cobrancas?mes=${mes}` : '/clientes/cobrancas?atrasadas=1'}
          aria-current={atrasadas ? 'true' : undefined}
          className={`${link} ${atrasadas ? '!border-laranja !bg-laranja !text-white' : 'text-laranja'}`}
        >
          Atrasadas
        </Link>
      </div>

      {!atrasadas && <p className="mb-1 text-xs text-slate-600">Resumo por data de vencimento</p>}
      <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          ['Previsto', total.previstoCentavos],
          ['Recebido', total.recebidoCentavos],
          ['A receber', total.aReceberCentavos],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <dt className="text-xs text-slate-600">{rotulo}</dt>
            <dd className="text-sm font-semibold text-marinho">{formatarReais(valor as number)}</dd>
          </div>
        ))}
      </dl>

      {cobrancas.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-700 shadow-sm">
          <p>{atrasadas ? 'Nenhuma cobrança atrasada. 🎯' : 'Nenhuma cobrança neste mês.'}</p>
          <Link
            href={atrasadas ? `/clientes/cobrancas?mes=${mes}` : '/clientes'}
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-laranja px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
          >
            {atrasadas ? 'Ver o mês' : 'Ver clientes'}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cobrancas.map((c) => (
            <CartaoCobranca key={c.id} cobranca={c} hoje={hoje} diasLembrete={config.diasLembreteCobranca} />
          ))}
        </div>
      )}
    </div>
  )
}
