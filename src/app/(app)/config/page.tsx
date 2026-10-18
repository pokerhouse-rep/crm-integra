import { LogOut } from 'lucide-react'
import { sair } from '../../login/actions'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarModelos, listarTodasOpcoes, obterConfig } from '@/lib/servicos/config'
import { FormPrazos } from '@/components/config/FormPrazos'
import { listarServicos } from '@/lib/servicos/catalogo'
import { ListaServicos } from '@/components/config/ListaServicos'
import { ListaOpcoes } from '@/components/config/ListaOpcoes'
import { EditorModelos } from '@/components/config/EditorModelos'

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-marinho">{titulo}</h2>
      {children}
    </section>
  )
}

export default async function Pagina() {
  const db = await criarClienteServidor()
  const [config, modelos, nichos, origens, motivos, servicos] = await Promise.all([
    obterConfig(db),
    listarModelos(db),
    listarTodasOpcoes(db, 'nicho'),
    listarTodasOpcoes(db, 'origem'),
    listarTodasOpcoes(db, 'motivo_perda'),
    listarServicos(db, { incluirInativos: true }),
  ])
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-marinho">Configurações</h1>
      <Secao titulo="Retornos">
        <FormPrazos sequencia={config.sequenciaPadrao} diasReativacao={config.diasReativacao}
          diasRetornoProposta={config.diasRetornoProposta}
          diasLembreteCobranca={config.diasLembreteCobranca}
        />
      </Secao>
      <Secao titulo="Modelos de mensagem">
        <EditorModelos modelos={modelos} />
      </Secao>
      <Secao titulo="Catálogo de serviços">
        <ListaServicos servicos={servicos} />
      </Secao>
      <Secao titulo="Nichos">
        <ListaOpcoes tipo="nicho" opcoes={nichos} />
      </Secao>
      <Secao titulo="Origens">
        <ListaOpcoes tipo="origem" opcoes={origens} />
      </Secao>
      <Secao titulo="Motivos de perda">
        <ListaOpcoes tipo="motivo_perda" opcoes={motivos} />
      </Secao>
      <form action={sair} className="md:hidden">
        <button
          type="submit"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-azul"
        >
          <LogOut size={20} aria-hidden /> Sair
        </button>
      </form>
    </div>
  )
}
