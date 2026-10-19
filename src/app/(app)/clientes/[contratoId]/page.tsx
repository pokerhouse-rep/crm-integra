import Link from 'next/link'
import { notFound } from 'next/navigation'
import { competenciaDe, horizonteCobrancas, valorVigente } from '@/lib/dominio/cobrancas'
import { formatarDataBR, hojeEmPalmas } from '@/lib/dominio/datas'
import { formatarReais } from '@/lib/dominio/dinheiro'
import { criarClienteServidor } from '@/lib/supabase/server'
import { obterConfig } from '@/lib/servicos/config'
import { obterContrato } from '@/lib/servicos/contratos'
import { ErroNegocio } from '@/lib/servicos/tipos'
import { uuidValido } from '@/lib/validacao'
import { CartaoCobranca } from '@/components/cobrancas/CartaoCobranca'
import { AcoesContrato } from '@/components/clientes/AcoesContrato'
import { descreverItem } from '@/lib/dominio/contratos'
import { FormReajuste } from '@/components/clientes/FormReajuste'
import { COR_STATUS_CONTRATO, ROTULO_STATUS_CONTRATO } from '@/components/propostas/rotulos'

export const dynamic = 'force-dynamic'

export default async function ContratoPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params
  if (!uuidValido(contratoId)) notFound()
  const db = await criarClienteServidor()
  const hoje = hojeEmPalmas()
  const [detalhe, config] = await Promise.all([
    obterContrato(db, contratoId, hoje).catch((e) => {
      if (e instanceof ErroNegocio) return null
      throw e
    }),
    obterConfig(db),
  ])
  if (!detalhe) notFound()
  const { contrato: c, reajustes, cobrancas } = detalhe
  const competenciaHoje = competenciaDe(hoje)
  const mesSeguinte = horizonteCobrancas(hoje).slice(0, 7)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <Link href="/clientes" className="inline-flex min-h-11 items-center text-sm text-azul underline">
          ‹ Clientes
        </Link>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-marinho">{c.descricao}</h1>
            <p className="text-sm text-slate-600">
              <Link href={`/leads/${c.lead.id}`} className="text-azul underline">
                {c.lead.nome_contato}
              </Link>
              {c.lead.empresa ? ` · ${c.lead.empresa}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COR_STATUS_CONTRATO[c.status]}`}>
            {ROTULO_STATUS_CONTRATO[c.status]}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Vence dia {c.dia_vencimento} · início {formatarDataBR(c.data_inicio)}
          {c.pausado_em ? ` · pausado em ${formatarDataBR(c.pausado_em)}` : ''}
          {c.cancelado_em ? ` · cancelado em ${formatarDataBR(c.cancelado_em)}` : ''}
        </p>
      </header>

      <section aria-labelledby="titulo-itens" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="titulo-itens" className="text-base font-semibold text-marinho">
          Itens
        </h2>
        <ul className="mt-2 space-y-3">
          {c.itens.map((i) => {
            const rs = reajustes
              .filter((r) => r.contrato_item_id === i.id)
              .map((r) => ({ aPartirDe: r.a_partir_de, valorCentavos: r.valor_centavos }))
            const mesRef = i.mes_inicio && i.mes_inicio > competenciaHoje ? i.mes_inicio : competenciaHoje
            const vigente = valorVigente(i.valor_centavos, rs, mesRef)
            return (
              <li key={i.id} className="text-sm text-slate-700">
                <p className="font-medium text-slate-900">{i.descricao}</p>
                <p>{descreverItem(i)}</p>
                {i.tipo === 'recorrente' && (
                  <>
                    <p>Valor vigente: {formatarReais(vigente)}/mês</p>
                    {rs.length > 0 && (
                      <p className="text-xs text-slate-500">
                        Reajustes:{' '}
                        {[...rs]
                          .sort((a, b) => a.aPartirDe.localeCompare(b.aPartirDe))
                          .map((r) => `${r.aPartirDe.slice(5, 7)}/${r.aPartirDe.slice(0, 4)} → ${formatarReais(r.valorCentavos)}`)
                          .join(' · ')}
                      </p>
                    )}
                    {c.status !== 'cancelado' && (
                      <FormReajuste itemId={i.id} valorVigenteCentavos={vigente} mesPadrao={mesSeguinte} />
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <AcoesContrato contratoId={c.id} status={c.status} />

      <section aria-labelledby="titulo-cobrancas">
        <h2 id="titulo-cobrancas" className="mb-2 text-base font-semibold text-marinho">
          Cobranças
        </h2>
        {cobrancas.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <p>Nenhuma cobrança neste contrato.</p>
            <Link
              href="/clientes/cobrancas"
              className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-laranja px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-azul"
            >
              Ver cobranças do mês
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {cobrancas.map((cb) => (
              <CartaoCobranca key={cb.id} cobranca={cb} hoje={hoje} diasLembrete={config.diasLembreteCobranca} permitirEdicao />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
