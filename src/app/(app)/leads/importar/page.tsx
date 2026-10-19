import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarOpcoes } from '@/lib/servicos/config'
import { ImportarLeads } from '@/components/leads/ImportarLeads'

export const dynamic = 'force-dynamic'

export default async function ImportarPagina() {
  const db = await criarClienteServidor()
  const [nichos, origens] = await Promise.all([listarOpcoes(db, 'nicho'), listarOpcoes(db, 'origem')])
  const origemPadrao = origens.find((o) => o.nome === 'Prospecção ativa')?.id ?? ''
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-marinho">Importar planilha</h1>
        <Link href="/leads" className="flex min-h-11 items-center px-2 text-sm font-medium text-azul underline">
          Voltar
        </Link>
      </header>
      <p className="text-sm text-slate-600">
        Envie um arquivo CSV (separador ; ou ,). Colunas aceitas: nome e whatsapp (obrigatórias), empresa, email, cidade,
        nicho, origem, link do mvp e observacoes. Até 1000 linhas e 1 MB.{' '}
        <a href="/exportar/modelo" download className="font-medium text-azul underline">
          Baixar modelo
        </a>
      </p>
      <ImportarLeads nichos={nichos} origens={origens} origemPadraoId={origemPadrao} />
    </div>
  )
}
