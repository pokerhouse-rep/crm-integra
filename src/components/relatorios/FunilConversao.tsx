import { taxa, type ContagemConversao } from '@/lib/dominio/relatorios'

function formatarTaxa(v: number | null): string {
  return v === null ? '—' : `${String(v).replace('.', ',')}%`
}

export function FunilConversao({ total }: { total: ContagemConversao }) {
  const barras = [
    { rotulo: 'MVPs enviados', valor: total.mvp, anterior: null as number | null },
    { rotulo: 'Responderam', valor: total.resposta, anterior: total.mvp },
    { rotulo: 'Propostas enviadas', valor: total.proposta, anterior: total.resposta },
    { rotulo: 'Fechamentos', valor: total.fechamento, anterior: total.proposta },
  ]
  const maior = Math.max(...barras.map((b) => b.valor), 0)
  return (
    <div>
      <ul className="space-y-3">
        {barras.map((b) => (
          <li key={b.rotulo}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
              <span className="font-medium text-slate-700">{b.rotulo}</span>
              <span className="text-slate-600">
                <strong className="text-marinho">{b.valor}</strong>
                {b.anterior !== null && <> · {formatarTaxa(taxa(b.valor, b.anterior))} da anterior</>}
              </span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-azul" style={{ width: `${maior ? (b.valor / maior) * 100 : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Conta os leads com cada acontecimento no período; num período curto uma etapa pode superar a anterior.
      </p>
    </div>
  )
}
