import { dividirParcelas, totaisProposta, type ItemProposta } from '@/lib/dominio/propostas'
import { formatarReais } from '@/lib/dominio/dinheiro'

/** Texto "em 3x de R$ 450,00" quando há um único item de valor único parcelado. */
function textoParcelas(itens: ItemProposta[], unicoCentavos: number): string | null {
  const unicos = itens.filter((i) => i.tipo === 'unico')
  if (unicos.length !== 1 || unicos[0].parcelas <= 1 || unicoCentavos <= 0) return null
  const n = unicos[0].parcelas
  const partes = dividirParcelas(unicoCentavos, n)
  if (partes[0] === partes[partes.length - 1]) return `em ${n}x de ${formatarReais(partes[0])}`
  return `em ${n}x: 1ª de ${formatarReais(partes[0])}, demais de ${formatarReais(partes[1])}`
}

export function ResumoTotais({ itens }: { itens: ItemProposta[] }) {
  const t = totaisProposta(itens)
  const subtotal = itens.reduce((s, i) => s + i.valorCentavos, 0)
  const parcelas = textoParcelas(itens, t.unicoCentavos)
  return (
    <section aria-label="Totais da proposta" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-marinho">Totais</h2>
      <dl className="mt-2 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3 text-slate-600">
          <dt>Subtotal</dt>
          <dd>{formatarReais(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-slate-600">
          <dt>Desconto</dt>
          <dd>{t.descontoCentavos > 0 ? `− ${formatarReais(t.descontoCentavos)}` : formatarReais(0)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3 border-t border-slate-200 pt-2 text-base font-semibold text-marinho">
          <dt>Total único</dt>
          <dd>{formatarReais(t.unicoCentavos)}</dd>
          {parcelas && <dd className="w-full text-right text-sm font-normal text-slate-600">{parcelas}</dd>}
        </div>
        <div className="flex justify-between gap-3 text-base font-semibold text-marinho">
          <dt>Total mensal</dt>
          <dd>{formatarReais(t.recorrenteCentavos)}/mês</dd>
        </div>
      </dl>
    </section>
  )
}
