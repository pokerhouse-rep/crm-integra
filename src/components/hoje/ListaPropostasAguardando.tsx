import Link from 'next/link'
import { formatarValorNegociacao } from '@/lib/dominio/dinheiro'
import type { PropostaAguardando } from '@/lib/servicos/propostas'

function rotuloEnviada(dias: number): string {
  if (dias <= 0) return 'enviada hoje'
  if (dias === 1) return 'enviada ontem'
  return `enviada há ${dias} dias`
}

export function ListaPropostasAguardando({ propostas }: { propostas: PropostaAguardando[] }) {
  if (propostas.length === 0) return null
  return (
    <section aria-labelledby="sec-propostas" className="mt-6">
      <h2 id="sec-propostas" className="mb-2 text-sm font-semibold uppercase tracking-wide text-marinho">
        Propostas aguardando resposta ({propostas.length})
      </h2>
      <ul className="space-y-3">
        {propostas.map((p) => {
          const valor = formatarValorNegociacao(p)
          return (
            <li key={p.id}>
              <Link
                href={`/leads/${p.leadId}/propostas/${p.id}`}
                className="flex min-h-11 flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-visible:outline-2 focus-visible:outline-azul"
              >
                <span className="font-medium text-marinho">
                  {p.nomeLead}
                  {p.empresa ? ` · ${p.empresa}` : ''}
                </span>
                <span className="text-sm text-slate-600">
                  v{p.versao}
                  {valor ? ` · ${valor}` : ''} · {rotuloEnviada(p.dias)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
