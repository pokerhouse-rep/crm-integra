import { formatarReais, formatarValorNegociacao } from '@/lib/dominio/dinheiro'
import type { ResumoVendas } from '@/lib/dominio/relatorios'

interface Props {
  vendas: ResumoVendas
  mrrCentavos: number
  recebimentos: { recebidoCentavos: number; aReceberCentavos: number; atrasadoCentavos: number }
}

function valor(unicoCentavos: number, recorrenteCentavos: number): string {
  return formatarValorNegociacao({ unicoCentavos, recorrenteCentavos }) || formatarReais(0)
}

function Cartao({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`mt-1 text-base font-semibold ${destaque ? 'text-laranja' : 'text-marinho'}`}>{valor}</p>
    </div>
  )
}

export function CartoesFinanceiro({ vendas, mrrCentavos, recebimentos }: Props) {
  const ticket =
    vendas.ticketUnicoCentavos === null || vendas.ticketMensalCentavos === null
      ? '—'
      : valor(vendas.ticketUnicoCentavos, vendas.ticketMensalCentavos)
  const dias = vendas.tempoMedioDias
  const tempo = dias === null ? '—' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`
  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      <Cartao titulo="Vendido no período" valor={valor(vendas.unicoCentavos, vendas.mensalCentavos)} />
      <Cartao titulo="Contratos fechados" valor={String(vendas.contratos)} />
      <Cartao titulo="Ticket médio" valor={ticket} />
      <Cartao titulo="Tempo médio até fechar" valor={tempo} />
      <Cartao titulo="MRR hoje" valor={formatarReais(mrrCentavos)} />
      <Cartao titulo="Recebido no período" valor={formatarReais(recebimentos.recebidoCentavos)} />
      <Cartao titulo="A receber no período" valor={formatarReais(recebimentos.aReceberCentavos)} />
      <Cartao
        titulo="Atrasado no período"
        valor={formatarReais(recebimentos.atrasadoCentavos)}
        destaque={recebimentos.atrasadoCentavos > 0}
      />
    </div>
  )
}
