import Link from 'next/link'
import { formatarDataBR } from '@/lib/dominio/datas'
import { descreverItem } from '@/lib/dominio/contratos'
import type { ContratoResumo } from '@/lib/servicos/contratos'
import { COR_STATUS_CONTRATO, ROTULO_STATUS_CONTRATO } from '@/components/propostas/rotulos'

export function CartaoContrato({ contrato: c }: { contrato: ContratoResumo }) {
  const nome = c.lead.empresa ? `${c.lead.nome_contato} · ${c.lead.empresa}` : c.lead.nome_contato
  return (
    <Link
      href={`/clientes/${c.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm focus-visible:outline-2 focus-visible:outline-azul"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-marinho">{nome}</p>
          <p className="text-sm text-slate-600">{c.descricao}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COR_STATUS_CONTRATO[c.status]}`}>
          {ROTULO_STATUS_CONTRATO[c.status]}
        </span>
      </div>
      <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
        {c.itens.map((i) => (
          <li key={i.id}>
            {i.descricao}: {descreverItem(i)}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Vence dia {c.dia_vencimento} · início {formatarDataBR(c.data_inicio)}
      </p>
    </Link>
  )
}
