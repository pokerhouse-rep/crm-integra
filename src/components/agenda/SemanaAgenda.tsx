import Link from 'next/link'
import { formatarDataBR, type DataISO } from '@/lib/dominio/datas'
import type { ItemAgenda } from '@/lib/servicos/agenda'
import { CartaoTarefa } from '@/components/hoje/CartaoTarefa'

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

export function SemanaAgenda({ semana, hoje }: { semana: Record<DataISO, ItemAgenda[]>; hoje: DataISO }) {
  const datas = Object.keys(semana).sort()
  return (
    <div className="grid gap-3 md:grid-cols-4 md:items-start lg:grid-cols-7">
      {datas.map((data, idx) => {
        const ehHoje = data === hoje
        const itens = semana[data]
        return (
          <section
            key={data}
            aria-labelledby={`dia-${data}`}
            className={`min-w-0 rounded-xl border p-3 ${ehHoje ? 'border-laranja bg-laranja/5' : 'border-slate-200 bg-white'}`}
          >
            <h2 id={`dia-${data}`} className={`text-sm font-semibold ${ehHoje ? 'text-laranja' : 'text-marinho'}`}>
              {DIAS[idx]} · {formatarDataBR(data).slice(0, 5)}
              {ehHoje && <span className="ml-1 text-xs font-medium">(hoje)</span>}
            </h2>
            {itens.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Nada agendado.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {itens.map((item) =>
                  item.tipo === 'retorno' ? (
                    <li key={`r-${item.retorno.id}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <span className="rounded-full bg-azul/15 px-2 py-0.5 text-xs font-medium text-marinho">
                        {item.passo === 0 ? 'Retorno' : `Retorno ${item.passo}/${item.totalPassos}`}
                      </span>
                      <Link
                        href={`/leads/${item.lead.id}`}
                        className="mt-1 flex min-h-11 items-center text-sm font-medium break-words text-azul underline"
                      >
                        {item.lead.nome_contato}
                      </Link>
                    </li>
                  ) : (
                    <li key={`t-${item.tarefa.id}`}>
                      <CartaoTarefa
                        hoje={hoje}
                        podeExcluir
                        dados={{
                          id: item.tarefa.id,
                          titulo: item.tarefa.titulo,
                          data: item.tarefa.data,
                          hora: item.tarefa.hora,
                          atrasado: false,
                          lead: item.lead ? { id: item.lead.id, nome: item.lead.nome_contato } : null,
                        }}
                      />
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
