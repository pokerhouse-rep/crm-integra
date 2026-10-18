import { formatarDataBR } from '@/lib/dominio/datas'
import { formatarPercentual, formatarReais, formatarValorNegociacao } from '@/lib/dominio/dinheiro'
import { descontoDoItem, valorLiquido, type ItemProposta } from '@/lib/dominio/propostas'

function dataEnvio(iso: string | null): string | null {
  if (!iso) return null
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Araguaina' }).format(new Date(iso))
  return formatarDataBR(d)
}

/** Item em modo leitura (versões enviadas e histórico). */
export function ItemLeitura({ item }: { item: ItemProposta }) {
  const desc = descontoDoItem(item)
  const detalhe =
    item.tipo === 'recorrente'
      ? `${formatarReais(item.valorCentavos)}/mês${item.mesInicio ? ` · desde ${item.mesInicio.slice(5, 7)}/${item.mesInicio.slice(0, 4)}` : ''}`
      : item.parcelas > 1
        ? `${formatarReais(item.valorCentavos)} em ${item.parcelas}x`
        : `${formatarReais(item.valorCentavos)} à vista`
  return (
    <li className="py-2">
      <p className="text-sm font-medium break-words text-slate-800">{item.descricao}</p>
      <p className="text-sm text-slate-600">{detalhe}</p>
      {item.desconto && (
        <p className="text-sm text-slate-600">
          Desconto {item.desconto.tipo === 'percentual' ? formatarPercentual(item.desconto.valor) : formatarReais(desc)} →{' '}
          {formatarReais(valorLiquido(item))}
          {item.tipo === 'recorrente' ? '/mês' : ''}
        </p>
      )}
    </li>
  )
}

export interface VersaoHistorico {
  numero: number
  enviadaEm: string | null
  unicoCentavos: number
  recorrenteCentavos: number
  itens: ItemProposta[]
}

export function HistoricoVersoes({ versoes }: { versoes: VersaoHistorico[] }) {
  if (versoes.length === 0) return null
  return (
    <section aria-labelledby="titulo-historico" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="titulo-historico" className="text-base font-semibold text-marinho">
        Versões anteriores
      </h2>
      <div className="mt-2 space-y-2">
        {versoes.map((v) => {
          const enviada = dataEnvio(v.enviadaEm)
          return (
            <details key={v.numero} className="rounded-lg border border-slate-200">
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 px-3 py-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-azul">
                <span className="font-medium">v{v.numero}</span>
                <span className="text-slate-600">{formatarValorNegociacao(v) || formatarReais(0)}</span>
                <span className="text-xs text-slate-500">{enviada ? `enviada em ${enviada}` : 'não enviada'}</span>
              </summary>
              <ul className="divide-y divide-slate-100 px-3 pb-2">
                {v.itens.map((i, idx) => (
                  <ItemLeitura key={idx} item={i} />
                ))}
              </ul>
            </details>
          )
        })}
      </div>
    </section>
  )
}
