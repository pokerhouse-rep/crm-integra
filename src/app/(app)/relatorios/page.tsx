import { hojeEmPalmas } from '@/lib/dominio/datas'
import { resolverPeriodo, rotuloPeriodo } from '@/lib/dominio/periodo'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarOpcoes } from '@/lib/servicos/config'
import { relatorioConversao, relatorioFinanceiro, relatorioMotivos } from '@/lib/servicos/relatorios'
import { FiltrosRelatorio } from '@/components/relatorios/FiltrosRelatorio'
import { FunilConversao } from '@/components/relatorios/FunilConversao'
import { TabelaConversao } from '@/components/relatorios/TabelaConversao'
import { CartoesFinanceiro } from '@/components/relatorios/CartoesFinanceiro'
import { ListaMotivos } from '@/components/relatorios/ListaMotivos'

export const dynamic = 'force-dynamic'

type Params = { periodo?: string; de?: string; ate?: string; nicho?: string; origem?: string }

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-marinho">{titulo}</h2>
      {children}
    </section>
  )
}

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const db = await criarClienteServidor()
  const hoje = hojeEmPalmas()
  const periodo = resolverPeriodo(params, hoje)
  const [nichos, origens] = await Promise.all([listarOpcoes(db, 'nicho'), listarOpcoes(db, 'origem')])
  // Id desconhecido na URL é ignorado em vez de zerar o relatório.
  const nichoId = nichos.find((n) => n.id === params.nicho)?.id ?? null
  const origemId = origens.find((o) => o.id === params.origem)?.id ?? null

  const [conversao, financeiro, motivos] = await Promise.all([
    relatorioConversao(db, periodo, { nichoId, origemId }),
    relatorioFinanceiro(db, periodo, hoje),
    relatorioMotivos(db, periodo),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-marinho">Relatórios</h1>
        <p className="text-sm text-slate-600">{rotuloPeriodo(periodo)}</p>
      </header>
      <Secao titulo="Filtros">
        <FiltrosRelatorio
          periodo={periodo.chave}
          de={periodo.de}
          ate={periodo.ate}
          nichoId={nichoId ?? ''}
          origemId={origemId ?? ''}
          nichos={nichos.map((n) => ({ id: n.id, nome: n.nome }))}
          origens={origens.map((o) => ({ id: o.id, nome: o.nome }))}
        />
      </Secao>
      <Secao titulo="Conversão">
        <FunilConversao total={conversao.total} />
      </Secao>
      <Secao titulo="Por nicho">
        <TabelaConversao grupos={conversao.porNicho} rotuloGrupo="Nicho" />
      </Secao>
      <Secao titulo="Por origem">
        <TabelaConversao grupos={conversao.porOrigem} rotuloGrupo="Origem" />
      </Secao>
      <Secao titulo="Financeiro">
        <CartoesFinanceiro
          vendas={financeiro.vendas}
          mrrCentavos={financeiro.mrrCentavos}
          recebimentos={financeiro.recebimentos}
        />
      </Secao>
      <Secao titulo="Motivos de perda">
        <ListaMotivos motivos={motivos} />
      </Secao>
    </div>
  )
}
